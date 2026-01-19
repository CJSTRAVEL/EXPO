import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Home } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";
const API_URL = process.env.REACT_APP_BACKEND_URL;

// UK Postcode regex pattern - matches full postcodes like "SR8 5AB" or "SW1A1AA"
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

// Fetch real addresses for a UK postcode via backend API
const fetchPostcodeAddresses = async (postcode) => {
  try {
    const response = await fetch(`${API_URL}/api/postcode/${encodeURIComponent(postcode)}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.addresses || data.addresses.length === 0) return null;
    
    const addresses = data.addresses.map((addr) => {
      const parts = [
        addr.line_1,
        addr.line_2,
        addr.line_3,
        addr.town_or_city,
        addr.county,
        addr.postcode || data.postcode
      ].filter(part => part && part.trim() !== '');
      
      return {
        description: parts.join(', '),
        mainText: addr.line_1 || '',
        secondaryText: [addr.line_2, addr.town_or_city, addr.postcode || data.postcode].filter(p => p && p.trim()).join(', ')
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
  "data-testid": dataTestId 
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [postcodeData, setPostcodeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const dropdownRef = useRef(null);
  const mapsLoaded = useRef(false);

  const isValidPostcode = useCallback((text) => UK_POSTCODE_REGEX.test(text.trim()), []);

  // Load Google Maps once
  useEffect(() => {
    if (mapsLoaded.current) return;
    
    const loadScript = () => {
      if (window.google?.maps?.places) {
        initAutocomplete();
        return;
      }
      
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initAutocomplete;
      document.head.appendChild(script);
    };

    const initAutocomplete = () => {
      if (!inputRef.current || autocompleteRef.current) return;
      
      mapsLoaded.current = true;
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
    };

    loadScript();
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

  // Sync value prop
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

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
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => postcodeData?.addresses?.length && setShowDropdown(true)}
        placeholder={placeholder}
        className="pl-10"
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
      
      {showDropdown && postcodeData?.addresses?.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl max-h-80 overflow-y-auto"
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
