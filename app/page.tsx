'use client';

import { useState } from 'react';
import MapView from '../components/Map/MapView';
import ChatBox from '../components/Chat/ChatBox';
import TransitSchedule from '../components/Transit/TransitSchedule';

interface BusStop {
  id: string;
  name: string;
  position: {
    lat: number;
    lng: number;
  };
}

const FE_LOCATION = {
  lat: 46.0448,
  lng: 14.4892,
};

export default function Home() {
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [destination, setDestination] = useState<BusStop | null>(null);
  const [route, setRoute] = useState<google.maps.DirectionsResult | null>(null);

  const fetchNearbyStops = async (map: google.maps.Map) => {
    const service = new google.maps.places.PlacesService(map);

    const request = {
      location: map.getCenter(),
      radius: 1500, // 1.5km radius
      type: 'transit_station',
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const busStops = results.map((place) => ({
          id: place.place_id!,
          name: place.name!,
          position: {
            lat: place.geometry!.location!.lat(),
            lng: place.geometry!.location!.lng(),
          },
        }));
        setNearbyStops(busStops);
      }
    });
  };

  return (
      <main className="flex flex-col">
        <div className="w-full p-4">
          <ChatBox onSendMessage={() => {}} />
          <TransitSchedule
              stop={selectedStop}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
          />
        </div>
      </main>
  );
}


/*
*         <div className="flex-1">
          <MapView
              route={route}
              onStopSelect={(stop) => setSelectedStop(stop)} // Update selected stop
          />
        </div>
*
* */