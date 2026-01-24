import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Home } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";
const API_URL = process.env.REACT_APP_BACKEND_URL;

// UK Postcode regex pattern - matches full postcodes like "SR8 5AB" or "SW1A1AA"
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

// Global flag to track if Google Maps script is loading/loaded
let googleMapsLoading = false;
let googleMapsLoaded = false;
const loadCallbacks = [];

const loadGoogleMapsScript = (callback) => {
  // Already loaded
  if (googleMapsLoaded && window.google?.maps?.places) {
    callback();
    return;
  }
  
  // Add to callbacks queue
  loadCallbacks.push(callback);
  
  // Already loading, wait for it
  if (googleMapsLoading) {
    return;
  }
  
  // Check if already available
  if (window.google?.maps?.places) {
    googleMapsLoaded = true;
    loadCallbacks.forEach(cb => cb());
    loadCallbacks.length = 0;
    return;
  }
  
  // Start loading
  googleMapsLoading = true;
  
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
  script.async = true;
  script.onload = () => {
    googleMapsLoaded = true;
    googleMapsLoading = false;
    loadCallbacks.forEach(cb => cb());
    loadCallbacks.length = 0;
  };
  script.onerror = () => {
    googleMapsLoading = false;
    console.error("Failed to load Google Maps script");
  };
  document.head.appendChild(script);
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
        secondaryText: [addr.town_or_city, addr.postcode].filter(p => p).join(', ')
      };
    });
    
    return { postcode: data.postcode, addresses };
  } catch (error) {
    console.error("Postcode lookup error:", error);
    return null;
  }
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
  const autocompleteRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [postcodeData, setPostcodeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const dropdownRef = useRef(null);
  const initedRef = useRef(false);

  const isValidPostcode = useCallback((text) => UK_POSTCODE_REGEX.test(text.trim()), []);

  // Load Google Maps and initialize autocomplete
  useEffect(() => {
    if (initedRef.current) return;
    
    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) return; // Already initialized
      
      try {
        initedRef.current = true;
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["geocode", "establishment"],
          componentRestrictions: { country: "gb" },
          fields: ["formatted_address", "name"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          const address = place?.formatted_address || place?.name || "";
          if (address) {
            setInputValue(address);
            onChange(address);
            setShowDropdown(false);
            setPostcodeData(null);
          }
        });
      } catch (error) {
        console.error("Error initializing Google Maps Autocomplete:", error);
      }
    };

    loadGoogleMapsScript(initAutocomplete);
  }, [onChange]);

  // Postcode lookup
  useEffect(() => {
    const lookup = async () => {
      const trimmed = inputValue.trim();
      
      if (isValidPostcode(trimmed)) {
        setIsLoading(true);
        // Hide Google dropdown
        document.querySelectorAll('.pac-container').forEach(el => {
          el.style.visibility = 'hidden';
        });
        
        const data = await fetchPostcodeAddresses(trimmed);
        if (data?.addresses?.length) {
          setPostcodeData(data);
          setShowDropdown(true);
        } else {
          setPostcodeData(null);
          setShowDropdown(false);
        }
        setIsLoading(false);
      } else {
        setPostcodeData(null);
        setShowDropdown(false);
        // Show Google dropdown again
        document.querySelectorAll('.pac-container').forEach(el => {
          el.style.visibility = 'visible';
        });
      }
    };

    const timer = setTimeout(lookup, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isValidPostcode]);

  // Click outside handler
  useEffect(() => {
    const handler = (e) => {
      // Don't close if clicking on Google Places autocomplete dropdown
      if (e.target.closest('.pac-container')) {
        return;
      }
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (address) => {
    setInputValue(address.description);
    onChange(address.description);
    setShowDropdown(false);
    setPostcodeData(null);
  };

  // Handle input change - update local state and notify parent
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  // Track if we're currently typing to avoid sync issues
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Only sync from parent when value prop changes externally (e.g., form reset or flight lookup)
  useEffect(() => {
    // Don't sync if user is actively typing
    if (isTypingRef.current) return;
    
    // Sync when parent value differs from local state
    // This handles form reset, flight lookup auto-fill, etc.
    if (value !== undefined && value !== inputValue) {
      setInputValue(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Updated input change handler that tracks typing state
  const handleInputChangeWithTracking = (e) => {
    const newValue = e.target.value;
    isTypingRef.current = true;
    setInputValue(newValue);
    onChange(newValue);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Reset typing flag after a short delay
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 500);
  };

  // Calculate dropdown position
  const [dropdownStyle, setDropdownStyle] = useState({});
  
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showDropdown]);

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
        onChange={handleInputChangeWithTracking}
        onFocus={() => postcodeData?.addresses?.length && setShowDropdown(true)}
        placeholder={placeholder}
        className={`pl-10 ${className}`}
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
      
      {showDropdown && postcodeData?.addresses?.length > 0 && (
        <div 
          ref={dropdownRef}
          style={dropdownStyle}
          className="z-[99999] bg-white border border-gray-300 rounded-lg shadow-2xl max-h-80 overflow-y-auto"
        >
          <div className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold sticky top-0">
            📍 {postcodeData.addresses.length} addresses at {postcodeData.postcode}
          </div>
          {postcodeData.addresses.map((address, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2.5 text-left hover:bg-blue-50 flex items-start gap-2 border-b border-gray-100 last:border-0"
              onClick={() => handleSelect(address)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Home className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-sm block truncate">{address.mainText}</span>
                <span className="text-xs text-gray-500 block truncate">{address.secondaryText}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
