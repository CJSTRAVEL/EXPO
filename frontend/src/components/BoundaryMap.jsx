import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Trash2, Undo, Save } from "lucide-react";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const libraries = ["drawing", "places"];

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
};

// Default center (Newcastle upon Tyne)
const defaultCenter = {
  lat: 54.9783,
  lng: -1.6178,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
};

const drawingOptions = {
  drawingControl: true,
  drawingControlOptions: {
    position: 2, // google.maps.ControlPosition.TOP_CENTER
    drawingModes: ["polygon"],
  },
  polygonOptions: {
    fillColor: "#1a3a5c",
    fillOpacity: 0.3,
    strokeColor: "#1a3a5c",
    strokeWeight: 2,
    clickable: true,
    editable: true,
    draggable: true,
  },
};

const BoundaryMap = ({ 
  initialBoundary = null, 
  onBoundaryChange, 
  readOnly = false,
  height = "400px" 
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [polygon, setPolygon] = useState(null);
  const [boundary, setBoundary] = useState(initialBoundary);
  const [drawingManager, setDrawingManager] = useState(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);

  // Update boundary when initialBoundary changes
  useEffect(() => {
    if (initialBoundary && initialBoundary.length > 0) {
      setBoundary(initialBoundary);
    }
  }, [initialBoundary]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    
    // If we have an initial boundary, fit the map to show it
    if (boundary && boundary.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      boundary.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      map.fitBounds(bounds);
    }
  }, [boundary]);

  const onDrawingManagerLoad = useCallback((dm) => {
    setDrawingManager(dm);
  }, []);

  const onPolygonComplete = useCallback((poly) => {
    // Remove any existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }
    
    polygonRef.current = poly;
    setPolygon(poly);
    
    // Get the path coordinates
    const path = poly.getPath();
    const coordinates = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push({ lat: point.lat(), lng: point.lng() });
    }
    
    setBoundary(coordinates);
    if (onBoundaryChange) {
      onBoundaryChange(coordinates);
    }
    
    // Disable drawing mode after completing a polygon
    if (drawingManager) {
      drawingManager.setDrawingMode(null);
    }
    
    // Add listeners for editing
    window.google.maps.event.addListener(path, "set_at", () => {
      updateBoundaryFromPolygon(poly);
    });
    window.google.maps.event.addListener(path, "insert_at", () => {
      updateBoundaryFromPolygon(poly);
    });
    window.google.maps.event.addListener(path, "remove_at", () => {
      updateBoundaryFromPolygon(poly);
    });
  }, [drawingManager, onBoundaryChange]);

  const updateBoundaryFromPolygon = (poly) => {
    const path = poly.getPath();
    const coordinates = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push({ lat: point.lat(), lng: point.lng() });
    }
    setBoundary(coordinates);
    if (onBoundaryChange) {
      onBoundaryChange(coordinates);
    }
  };

  const clearBoundary = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    setPolygon(null);
    setBoundary(null);
    if (onBoundaryChange) {
      onBoundaryChange(null);
    }
  };

  const onExistingPolygonLoad = useCallback((poly) => {
    polygonRef.current = poly;
    setPolygon(poly);
    
    if (!readOnly) {
      // Add listeners for editing
      const path = poly.getPath();
      window.google.maps.event.addListener(path, "set_at", () => {
        updateBoundaryFromPolygon(poly);
      });
      window.google.maps.event.addListener(path, "insert_at", () => {
        updateBoundaryFromPolygon(poly);
      });
      window.google.maps.event.addListener(path, "remove_at", () => {
        updateBoundaryFromPolygon(poly);
      });
    }
  }, [readOnly, onBoundaryChange]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">Error loading maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, height }}
        center={defaultCenter}
        zoom={11}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        {!readOnly && !boundary && (
          <DrawingManager
            onLoad={onDrawingManagerLoad}
            onPolygonComplete={onPolygonComplete}
            options={drawingOptions}
          />
        )}
        
        {boundary && boundary.length > 0 && (
          <Polygon
            paths={boundary}
            options={{
              fillColor: "#1a3a5c",
              fillOpacity: 0.3,
              strokeColor: "#1a3a5c",
              strokeWeight: 2,
              clickable: !readOnly,
              editable: !readOnly,
              draggable: !readOnly,
            }}
            onLoad={onExistingPolygonLoad}
          />
        )}
      </GoogleMap>
      
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {boundary && boundary.length > 0 
              ? `Boundary defined with ${boundary.length} points`
              : "Click the polygon tool and draw on the map to define a boundary"
            }
          </div>
          {boundary && boundary.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearBoundary}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Boundary
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default BoundaryMap;
