import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";

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

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Enter address...",
  id,
  "data-testid": dataTestId 
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        if (inputRef.current && !autocompleteRef.current) {
          autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
            types: ["address"],
            componentRestrictions: { country: "gb" }, // Restrict to UK
            fields: ["formatted_address", "geometry", "name"],
          });

          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current.getPlace();
            if (place && place.formatted_address) {
              onChange(place.formatted_address);
            } else if (place && place.name) {
              onChange(place.name);
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

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
        id={id}
        data-testid={dataTestId}
        autoComplete="off"
      />
    </div>
  );
};

export default AddressAutocomplete;
