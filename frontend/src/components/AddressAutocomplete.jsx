import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Home, Building2 } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// UK Postcode regex pattern - matches full postcodes like "SR8 5AB" or "SW1A1AA"
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

// Generate a session token for grouping autocomplete requests
const generateSessionToken = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Fetch address suggestions from backend proxy
const fetchPlaceSuggestions = async (input, sessionToken) => {
  try {
    const response = await fetch(
      `${API_URL}/api/places/autocomplete?input=${encodeURIComponent(input)}&sessiontoken=${sessionToken}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.error) {
      console.error("Places API error:", data.error);
      return null;
    }
    
    return data.predictions || [];
  } catch (error) {
    console.error("Places autocomplete error:", error);
    return null;
  }
};

// Fetch real addresses for a UK postcode via backend API
const fetchPostcodeAddresses = async (postcode) => {
  try {
    const response = await fetch(`${API_URL}/api/postcode/${encodeURIComponent(postcode)}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.addresses || data.addresses.length === 0) return null;
    
    const addresses = data.addresses.map((addr) => {
      const fullAddress = addr.full_address || [addr.line_1, addr.line_2, addr.town_or_city, addr.county, addr.postcode].filter(p => p).join(', ');
      
      return {
        description: fullAddress,
        mainText: addr.line_1 || '',
        secondaryText: [addr.town_or_city, addr.postcode].filter(p => p).join(', '),
        isPostcode: true
      };
    });
    
    return { postcode: data.postcode, addresses };
  } catch (error) {
    console.error("Postcode lookup error:", error);
    return null;
  }
};

// Dropdown component rendered via portal
const DropdownPortal = ({ children, style }) => {
  return createPortal(
    <div style={style} className="address-autocomplete-dropdown">
      {children}
    </div>,
    document.body
  );
};

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Enter postcode or address...",
  id,
  className = "",
  "data-testid": dataTestId 
}) => {
  const inputRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [postcodeData, setPostcodeData] = useState(null);
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const dropdownRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const sessionTokenRef = useRef(generateSessionToken());

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isValidPostcode = useCallback((text) => UK_POSTCODE_REGEX.test(text.trim()), []);

  // Lookup addresses when input changes
  useEffect(() => {
    const lookup = async () => {
      const trimmed = inputValue.trim();
      
      if (!trimmed || trimmed.length < 2) {
        setPostcodeData(null);
        setPlaceSuggestions([]);
        setShowDropdown(false);
        return;
      }
      
      setIsLoading(true);
      
      // Check if it's a valid UK postcode format
      if (isValidPostcode(trimmed)) {
        const data = await fetchPostcodeAddresses(trimmed);
        if (data?.addresses?.length) {
          setPostcodeData(data);
          setPlaceSuggestions([]);
          setShowDropdown(true);
        } else {
          setPostcodeData(null);
          // Fall back to place search for postcodes not found
          const suggestions = await fetchPlaceSuggestions(trimmed, sessionTokenRef.current);
          setPlaceSuggestions(suggestions || []);
          setShowDropdown((suggestions || []).length > 0);
        }
      } else {
        // Regular address search
        setPostcodeData(null);
        const suggestions = await fetchPlaceSuggestions(trimmed, sessionTokenRef.current);
        setPlaceSuggestions(suggestions || []);
        setShowDropdown((suggestions || []).length > 0);
      }
      
      setIsLoading(false);
    };

    const timer = setTimeout(lookup, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isValidPostcode]);

  // Click outside handler
  useEffect(() => {
    const handler = (e) => {
      // Check if click is inside ANY address autocomplete dropdown
      const allDropdowns = document.querySelectorAll('.address-autocomplete-dropdown');
      for (const dropdown of allDropdowns) {
        if (dropdown.contains(e.target)) return;
      }
      // Check if click is on our specific input
      if (inputRef.current?.contains(e.target)) return;
      setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  
  // Close dropdown when input loses focus (with small delay to allow click on dropdown)
  const handleBlur = () => {
    setTimeout(() => {
      // Check if focus moved to the dropdown
      const activeEl = document.activeElement;
      const dropdowns = document.querySelectorAll('.address-autocomplete-dropdown');
      for (const dropdown of dropdowns) {
        if (dropdown.contains(activeEl)) return;
      }
      if (!inputRef.current?.contains(activeEl)) {
        setShowDropdown(false);
      }
    }, 150);
  };

  const handleSelect = (item) => {
    const address = item.description || item.mainText;
    setInputValue(address);
    onChange(address);
    setShowDropdown(false);
    setPostcodeData(null);
    setPlaceSuggestions([]);
    // Generate new session token after selection
    sessionTokenRef.current = generateSessionToken();
  };

  // Track if we're currently typing to avoid sync issues
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Only sync from parent when value prop changes externally
  useEffect(() => {
    if (isTypingRef.current) return;
    
    if (value !== undefined && value !== inputValue) {
      setInputValue(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    isTypingRef.current = true;
    setInputValue(newValue);
    onChange(newValue);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 500);
  };

  // Calculate dropdown position
  const [dropdownStyle, setDropdownStyle] = useState({});
  
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Calculate optimal width (min 380px, max viewport - 40px padding)
      let dropdownWidth = Math.max(rect.width, 380);
      dropdownWidth = Math.min(dropdownWidth, viewportWidth - 40);
      
      // Calculate left position - ensure dropdown doesn't go off-screen
      let leftPos = rect.left;
      if (leftPos + dropdownWidth > viewportWidth - 20) {
        leftPos = viewportWidth - dropdownWidth - 20;
      }
      if (leftPos < 20) leftPos = 20;
      
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: leftPos,
        width: dropdownWidth,
        maxHeight: '320px',
        overflowY: 'auto',
        zIndex: 999999,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      });
    }
  }, [showDropdown]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!showDropdown) return;
    
    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        let dropdownWidth = Math.max(rect.width, 380);
        dropdownWidth = Math.min(dropdownWidth, viewportWidth - 40);
        
        let leftPos = rect.left;
        if (leftPos + dropdownWidth > viewportWidth - 20) {
          leftPos = viewportWidth - dropdownWidth - 20;
        }
        if (leftPos < 20) leftPos = 20;
        
        setDropdownStyle(prev => ({
          ...prev,
          top: rect.bottom + 4,
          left: leftPos,
          width: dropdownWidth
        }));
      }
    };
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown]);

  const hasResults = (postcodeData?.addresses?.length > 0) || (placeSuggestions.length > 0);

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin z-10" />
      )}
      
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => hasResults && setShowDropdown(true)}
        placeholder={placeholder}
        className={`pl-10 ${className}`}
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
      
      {showDropdown && hasResults && (
        <DropdownPortal style={dropdownStyle}>
          {/* Postcode results */}
          {postcodeData?.addresses?.length > 0 && (
            <>
              <div className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold sticky top-0 rounded-t-lg">
                📍 {postcodeData.addresses.length} addresses at {postcodeData.postcode}
              </div>
              {postcodeData.addresses.map((address, index) => (
                <button
                  key={`postcode-${index}`}
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 flex items-start gap-2 border-b border-gray-100 last:border-0 last:rounded-b-lg"
                  onClick={() => handleSelect(address)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Home className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-sm block text-gray-900">{address.mainText}</span>
                    <span className="text-xs text-gray-500 block">{address.secondaryText}</span>
                  </div>
                </button>
              ))}
            </>
          )}
          
          {/* Google Places results */}
          {placeSuggestions.length > 0 && !postcodeData?.addresses?.length && (
            <>
              <div className="px-3 py-2 bg-gray-700 text-white text-xs font-semibold sticky top-0 rounded-t-lg">
                🔍 Address suggestions
              </div>
              {placeSuggestions.map((suggestion, index) => (
                <button
                  key={`place-${index}`}
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-start gap-2 border-b border-gray-100 last:border-0 last:rounded-b-lg"
                  onClick={() => handleSelect(suggestion)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Building2 className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-sm block text-gray-900">{suggestion.main_text || suggestion.description}</span>
                    {suggestion.secondary_text && (
                      <span className="text-xs text-gray-500 block">{suggestion.secondary_text}</span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </DropdownPortal>
      )}
    </div>
  );
};

export default AddressAutocomplete;
