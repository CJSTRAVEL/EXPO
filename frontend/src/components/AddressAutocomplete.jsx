import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Home } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";
const API_URL = process.env.REACT_APP_BACKEND_URL;

// UK Postcode regex pattern
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;
const PARTIAL_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9]?[A-Z]{0,2}$/i;

// Load Google Maps script
let googleMapsPromise = null;
const loadGoogleMaps = () => {
  if (googleMapsPromise) return googleMapsPromise;
  
  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve(window.google.maps);
      return;
    }
    
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  
  return googleMapsPromise;
};

// Fetch real addresses for a UK postcode via backend API
const fetchPostcodeAddresses = async (postcode) => {
  try {
    const response = await fetch(`${API_URL}/api/postcode/${encodeURIComponent(postcode)}`);
    
    if (!response.ok) {
      console.error("Postcode API error:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.addresses || data.addresses.length === 0) {
      return null;
    }
    
    // Format addresses from Ideal Postcodes response
    const addresses = data.addresses.map((addr) => {
      // Build full address string
      const parts = [
        addr.line_1,
        addr.line_2,
        addr.line_3,
        addr.town_or_city,
        addr.county,
        addr.postcode || data.postcode
      ].filter(part => part && part.trim() !== '');
      
      const fullAddress = parts.join(', ');
      const mainText = addr.line_1 || '';
      const secondaryParts = [addr.line_2, addr.town_or_city, addr.postcode || data.postcode].filter(p => p && p.trim());
      
      return {
        description: fullAddress,
        mainText: mainText,
        secondaryText: secondaryParts.join(', ')
      };
    });
    
    return {
      postcode: data.postcode,
      addresses: addresses
    };
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [postcodeData, setPostcodeData] = useState(null);
  const [isLoadingPostcode, setIsLoadingPostcode] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const dropdownRef = useRef(null);

  // Check if input looks like a UK postcode
  const isPostcode = useCallback((text) => {
    return UK_POSTCODE_REGEX.test(text.trim());
  }, []);

  const isPartialPostcode = useCallback((text) => {
    const cleaned = text.trim().replace(/\s+/g, '');
    return cleaned.length >= 5 && PARTIAL_POSTCODE_REGEX.test(text.trim());
  }, []);

  // Handle postcode lookup
  useEffect(() => {
    const lookupPostcode = async () => {
      const trimmedValue = inputValue.trim();
      if (isPostcode(trimmedValue) || (isPartialPostcode(trimmedValue) && trimmedValue.replace(/\s+/g, '').length >= 6)) {
        setIsLoadingPostcode(true);
        const data = await fetchPostcodeAddresses(trimmedValue);
        if (data && data.addresses && data.addresses.length > 0) {
          setPostcodeData(data);
          setShowDropdown(true);
        } else {
          setPostcodeData(null);
          setShowDropdown(false);
        }
        setIsLoadingPostcode(false);
      } else {
        setPostcodeData(null);
        setShowDropdown(false);
      }
    };

    const debounce = setTimeout(lookupPostcode, 500);
    return () => clearTimeout(debounce);
  }, [inputValue, isPostcode, isPartialPostcode]);

  // Initialize Google Maps autocomplete
  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        if (inputRef.current && !autocompleteRef.current) {
          autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
            types: ["geocode", "establishment"],
            componentRestrictions: { country: "gb" },
            fields: ["formatted_address", "geometry", "name"],
          });

          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current.getPlace();
            if (place && place.formatted_address) {
              setInputValue(place.formatted_address);
              onChange(place.formatted_address);
              setShowDropdown(false);
              setPostcodeData(null);
            } else if (place && place.name) {
              setInputValue(place.name);
              onChange(place.name);
              setShowDropdown(false);
              setPostcodeData(null);
            }
          });
          
          setIsLoaded(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Google Maps:", error);
      });

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  const handleAddressSelect = (address) => {
    setInputValue(address.description);
    onChange(address.description);
    setShowDropdown(false);
    setPostcodeData(null);
  };

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue && value !== undefined) {
      setInputValue(value);
    }
  }, [value]);

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      {isLoadingPostcode && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
      )}
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (postcodeData && postcodeData.addresses.length > 0) {
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        className="pl-10"
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
      
      {/* Postcode addresses dropdown - appears above Google autocomplete */}
      {showDropdown && postcodeData && postcodeData.addresses.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
          style={{ top: '100%' }}
        >
          <div className="px-3 py-2 bg-blue-50 border-b text-xs text-blue-700 font-medium sticky top-0 flex items-center justify-between">
            <span>{postcodeData.addresses.length} addresses at {postcodeData.postcode}</span>
            <span className="text-blue-500">Select an address</span>
          </div>
          {postcodeData.addresses.map((address, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2.5 text-left hover:bg-blue-50 flex items-start gap-2 border-b border-gray-100 last:border-0 transition-colors"
              onClick={() => handleAddressSelect(address)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Home className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="font-medium text-sm block truncate">{address.mainText}</span>
                <span className="text-xs text-muted-foreground block truncate">{address.secondaryText}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
