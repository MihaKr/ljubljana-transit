import { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, TransitLayer, Marker, DirectionsRenderer } from '@react-google-maps/api';

const center = {
    lat: 46.04472333644028,
    lng: 14.488927582764722
};

interface BusStop {
    id: string;
    position: google.maps.LatLngLiteral;
    name: string;
}

interface MapViewProps {
    onStopSelect: (stop: BusStop) => void;
    route?: google.maps.DirectionsResult | null;
}

const MapView = ({ onStopSelect, route }: MapViewProps) => {
    const [stops, setStops] = useState<BusStop[]>([]);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    const containerStyle = {
        width: '100%',
        height: '600px'
    };

    const onLoad = (map: google.maps.Map) => {
        setMap(map);
        const transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(map);
    };

    const fetchNearbyStops = (map: google.maps.Map) => {
        const service = new google.maps.places.PlacesService(map);

        const request = {
            location: map.getCenter(),
            radius: 10000,
            type: 'transit_station',
        };

        service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                const fetchedStops = results.map((place) => ({
                    id: place.place_id,
                    name: place.name || 'Unnamed Stop',
                    position: {
                        lat: place.geometry?.location?.lat()!,
                        lng: place.geometry?.location?.lng()!,
                    },
                }));
                setStops(fetchedStops);
            } else {
                console.error('Error fetching nearby bus stops:', status);
            }
        });
    };

    useEffect(() => {
        if (map) {
            fetchNearbyStops(map);
        }
    }, [map]);

    useEffect(() => {
        if (route) {
            setDirections(route);
        }
    }, [route]);

    return (
        <LoadScript
            googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
            libraries={['places']}
        >
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={14}
                onLoad={onLoad}
            >
                {!directions && stops.map((stop) => (
                    <Marker
                        key={stop.id}
                        position={stop.position}
                        onClick={() => onStopSelect(stop)}
                        title={stop.name}
                    />
                ))}

                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: false,
                            preserveViewport: true
                        }}
                    />
                )}
            </GoogleMap>
        </LoadScript>
    );
};

export default MapView;