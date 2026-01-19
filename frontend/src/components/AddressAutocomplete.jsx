import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Home } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";

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

// Fetch addresses for a UK postcode using postcodes.io (free API)
const fetchPostcodeAddresses = async (postcode) => {
  try {
    // First validate and get postcode info
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const response = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status !== 200) return null;
    
    const { parish, admin_ward, admin_district, region, postcode: formattedPostcode } = data.result;
    
    // Generate common house numbers for the postcode
    // Since postcodes.io doesn't provide individual addresses, we'll create suggestions
    const addresses = [];
    const areaName = parish || admin_ward || admin_district || region || '';
    
    // Add the postcode itself as first option
    addresses.push({
      description: `${formattedPostcode}, ${areaName}`,
      mainText: formattedPostcode,
      secondaryText: areaName
    });
    
    // Add common house number patterns
    const houseNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 25, 26, 28, 30];
    houseNumbers.forEach(num => {
      addresses.push({
        description: `${num}, ${formattedPostcode}, ${areaName}`,
        mainText: `${num}`,
        secondaryText: `${formattedPostcode}, ${areaName}`
      });
    });
    
    // Add flat/apartment options
    ['Flat 1', 'Flat 2', 'Flat 3', 'Flat A', 'Flat B', 'Ground Floor', 'First Floor'].forEach(flat => {
      addresses.push({
        description: `${flat}, ${formattedPostcode}, ${areaName}`,
        mainText: flat,
        secondaryText: `${formattedPostcode}, ${areaName}`
      });
    });
    
    return addresses;
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
  const [postcodeAddresses, setPostcodeAddresses] = useState([]);
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
      if (isPostcode(inputValue) || (isPartialPostcode(inputValue) && inputValue.length >= 6)) {
        setIsLoadingPostcode(true);
        const addresses = await fetchPostcodeAddresses(inputValue);
        if (addresses) {
          setPostcodeAddresses(addresses);
          setShowDropdown(true);
        }
        setIsLoadingPostcode(false);
      } else {
        setPostcodeAddresses([]);
        setShowDropdown(false);
      }
    };

    const debounce = setTimeout(lookupPostcode, 300);
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
            } else if (place && place.name) {
              setInputValue(place.name);
              onChange(place.name);
              setShowDropdown(false);
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
    // Don't call onChange here - wait for selection
  };

  const handleAddressSelect = (address) => {
    setInputValue(address.description);
    onChange(address.description);
    setShowDropdown(false);
    setPostcodeAddresses([]);
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
          if (postcodeAddresses.length > 0) {
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        className="pl-10"
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
      
      {/* Postcode addresses dropdown */}
      {showDropdown && postcodeAddresses.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          <div className="px-3 py-2 bg-slate-50 border-b text-xs text-muted-foreground font-medium">
            Select address at this postcode
          </div>
          {postcodeAddresses.map((address, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-start gap-2 border-b border-gray-100 last:border-0"
              onClick={() => handleAddressSelect(address)}
            >
              <Home className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-sm">{address.mainText}</span>
                <span className="text-xs text-muted-foreground block">{address.secondaryText}</span>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 bg-slate-50 text-xs text-muted-foreground text-center border-t">
            Type house number for specific address
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
