'use client';

import { useEffect, useState } from 'react';

interface TransitScheduleProps {
    stop: { id: string; name: string; position: { lat: number; lng: number } } | null;
}

interface BusSchedule {
    route: string;
    departureTime: string;
    arrivalTime: string;
}

interface NearbyStop {
    lat: number;
    lng: number;
    name: string;
}

const fe = {
    lat: 46.04472333644028, // FE coordinates
    lng: 14.488927582764722,
};

const TransitSchedule: React.FC<TransitScheduleProps> = ({ stop }) => {
    const [schedules, setSchedules] = useState<BusSchedule[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [nearbyStops, setNearbyStops] = useState<NearbyStop[]>([]);

    useEffect(() => {
        if (!stop) return;

        const findNearbyStops = (radius: number) => {
            const map = new google.maps.Map(document.createElement('div'));
            const service = new google.maps.places.PlacesService(map);
            const request = {
                location: stop.position,
                radius: radius,
                type: ['bus_station'],
            };

            service.nearbySearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    const stops = results.map((place) => ({
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        name: place.name || 'Unnamed Stop',
                    }));
                    setNearbyStops(stops);
                } else {
                    setError('Failed to fetch nearby stops');
                }
            });
        };

        findNearbyStops(1000); // 1 km radius
    }, [stop]);

    useEffect(() => {
        if (nearbyStops.length === 0) return;

        const fetchFullSchedule = async () => {
            const directionsService = new google.maps.DirectionsService();
            const allSchedules: BusSchedule[] = [];

            for (const stop of nearbyStops) {
                // Simulate full-day schedule by requesting at different times
                const timeIntervals = Array.from({ length: 8 }, (_, i) => 6 + i * 2); // Every 2 hours from 6 AM to 10 PM
                for (const hour of timeIntervals) {
                    const time = new Date();
                    time.setHours(hour, 0, 0);

                    const request = {
                        origin: fe,
                        destination: { lat: stop.lat, lng: stop.lng },
                        travelMode: google.maps.TravelMode.TRANSIT,
                        transitOptions: {
                            modes: [google.maps.TransitMode.BUS],
                            departureTime: time,
                        },
                    };

                    await new Promise<void>((resolve) =>
                        directionsService.route(request, (result, status) => {
                            if (status === google.maps.DirectionsStatus.OK && result) {
                                const stopSchedules = result.routes[0]?.legs[0]?.steps
                                    .filter((step) => step.transit)
                                    .map((step) => ({
                                        route: step.transit!.line.short_name || step.transit!.line.name,
                                        departureTime:
                                            step.transit!.departure_time?.text || 'No departure time',
                                        arrivalTime:
                                            step.transit!.arrival_time?.text || 'No arrival time',
                                    }));
                                allSchedules.push(...(stopSchedules || []));
                            }
                            resolve();
                        })
                    );
                }
            }

            setSchedules(allSchedules);
        };

        fetchFullSchedule();
    }, [nearbyStops]);

    if (!stop) return null;

    return (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
            <h3 className="font-bold">Bus Schedules for {stop.name}</h3>
            {error && <p className="text-red-500">{error}</p>}
            {schedules.length > 0 ? (
                <ul>
                    {schedules.map((schedule, index) => (
                        <li key={index}>
                            Route {schedule.route}: Departs at {schedule.departureTime}, Arrives at {schedule.arrivalTime}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Loading schedules...</p>
            )}

            <h4 className="mt-4 font-semibold">Nearby Stops:</h4>
            {nearbyStops.length > 0 ? (
                <ul>
                    {nearbyStops.map((nearbyStop, index) => (
                        <li key={index}>
                            {nearbyStop.name} - Location: {nearbyStop.lat}, {nearbyStop.lng}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Loading nearby stops...</p>
            )}
        </div>
    );
};

export default TransitSchedule;
