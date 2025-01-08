import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

class RouteError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status: number = 400
    ) {
        super(message);
        this.name = 'RouteError';
    }
}

interface TransitDetails {
    arrival_stop: {
        location: {
            lat: number;
            lng: number;
        };
        name: string;
    };
    departure_stop: {
        location: {
            lat: number;
            lng: number;
        };
        name: string;
    };
    arrival_time: {
        text: string;
        time_zone: string;
        value: number;
    };
    departure_time: {
        text: string;
        time_zone: string;
        value: number;
    };
    headsign: string;
    line: {
        agencies: Array<{
            name: string;
            phone: string;
            url: string;
        }>;
        short_name: string;
        vehicle: {
            icon: string;
            name: string;
            type: string;
        };
    };
    num_stops: number;
}

interface RouteStep {
    travel_mode: string;
    duration: {
        text: string;
        value: number;
    };
    html_instructions: string;
    transit_details?: TransitDetails;
}

function isoToTimestamp(isoString: string): number {
    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
        throw new Error('Invalid ISO 8601 string with time zone');
    }

    return date.getTime()/1000;
}

async function validateInput(origin: string, destination: string, arrivalTime: string) {
    if (!origin?.trim()) {
        throw new RouteError('Origin is required', 'INVALID_ORIGIN');
    }

    if (!destination?.trim()) {
        throw new RouteError('Destination is required', 'INVALID_DESTINATION');
    }
}


async function fetchBusRoutes(
    origin: string,
    destination: string,
    arrivalTime: string,
    lessWalking: boolean = false,
    lessTransfers: boolean = false
) {
    try {
        await validateInput(origin, destination, arrivalTime);

        const conv_time = Math.floor((isoToTimestamp(arrivalTime)));
        console.log(origin);
        console.log(destination)
        console.log(conv_time);
        console.log(lessWalking ? 'less_walking' : 'fewer_transfers')

        let usedParam = '';

        if(lessTransfers){
            usedParam = 'fewer_transfers';
        }
        else if(lessWalking){
            usedParam = 'less_walking';
        }


        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: origin,
                destination: destination,
                mode: 'transit',
                transit_mode: 'bus',
                arrival_time: conv_time,
                transit_routing_preference: usedParam,
                key: GOOGLE_API_KEY,
                alternatives: true
            },
            timeout: 5000,
        });

        console.log(lessWalking);

        console.log("here is response:\n" + response);

        if (response.data.status === 'ZERO_RESULTS') {
            throw new RouteError('No routes found', 'NO_ROUTES');
        }

        if (response.data.status === 'INVALID_REQUEST') {
            throw new RouteError('Invalid route request', 'INVALID_REQUEST');
        }

        if (!response.data.routes?.[0]?.legs?.[0]?.steps) {
            throw new RouteError('Invalid route data received', 'INVALID_RESPONSE');
        }

        const allRoutes = response.data.routes.map(route => {
            const steps: RouteStep[] = route.legs[0].steps;

            const walkingToStop = steps.find(step => step.travel_mode === 'WALKING' && !step.transit_details);
            const transitSteps = steps.filter(step => step.travel_mode === 'TRANSIT');
            const walkingFromStop = [...steps].reverse().find(step => step.travel_mode === 'WALKING' && !step.transit_details);

            if (transitSteps.length === 0) return null;

            const routeSegments = transitSteps.map((step, index) => {
                if (!step.transit_details) return null;

                const details = step.transit_details;

                return {
                    busNumber: details.line.short_name,
                    headsign: details.headsign,
                    departureStop: details.departure_stop.name,
                    departureTime: details.departure_time.text,
                    arrivalStop: details.arrival_stop.name,
                    arrivalTime: details.arrival_time.text,
                    duration: step.duration.text,
                    numStops: details.num_stops,
                    walkToStop: index === 0 && walkingToStop?.duration.text
                        ? walkingToStop.duration.text
                        : 'Stay at the same stop',
                    walkFromStop: index === transitSteps.length - 1 && walkingFromStop?.duration.text
                        ? walkingFromStop.duration.text
                        : 'Stay at the same stop',
                };
            }).filter(segment => segment !== null);

            return routeSegments.length > 0 ? routeSegments : null;
        }).filter(route => route !== null);

        console.log('Processed routes:', allRoutes);
        return allRoutes;
    } catch (error) {
        if (error instanceof RouteError) {
            throw error;
        }
        if (error instanceof AxiosError) {
            if (error.code === 'ECONNABORTED') {
                throw new RouteError('Request timeout', 'TIMEOUT', 504);
            }
            if (error.response?.status === 403) {
                throw new RouteError('API key invalid', 'AUTH_ERROR', 403);
            }
        }
        console.error('Error fetching bus routes:', error);
        throw new RouteError('Failed to fetch bus routes', 'INTERNAL_ERROR', 500);
    }
}


function formatRoutes(routes: any[]) {
    return routes
        .map((routeSegments, routeIndex) => {
            const routeNumber = routeIndex + 1;
            const segments = routeSegments
                .map(segment => {
                    return `Bus ${segment.busNumber} towards ${segment.headsign}:
        - Walk to stop: ${segment.walkToStop}
        - Departure: ${segment.departureStop} at ${segment.departureTime}
        - Arrival: ${segment.arrivalStop} at ${segment.arrivalTime}
        - Walk from stop: ${segment.walkFromStop}
        - Duration: ${segment.duration} (${segment.numStops} stops)`;
                })
                .join('\n');
            return `Route Option ${routeNumber}:\n${segments}`;
        })
        .join('\n\n\n');
}



export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const intentName = body.queryResult?.intent?.displayName;
        const contexts = body.queryResult.outputContexts || [];


        if (intentName === 'GET_route') {
            const arrivalTime_full = body.queryResult.parameters['time_preference'] || { "date_time": new Date().toISOString() };
            const arrivalTime = arrivalTime_full?.date_time || "No arrival time set";

            const destination = body.queryResult.parameters['destination'] || '';
            const origin = body.queryResult.parameters['origin'] || '';

            //console.log(destination)
            //console.log(origin)

            console.log(`Fetching routes to ${destination} from ${origin} with arrival time of ${arrivalTime}`);

            const busRoutes = await fetchBusRoutes(origin, destination, arrivalTime);

            if (busRoutes && busRoutes.length > 0) {
                const routeDetails = formatRoutes(busRoutes);

                return NextResponse.json({
                    fulfillmentMessages: [{
                        text: {
                            text: [
                                `I found the following bus routes to ${destination}:\n\n${routeDetails}\n\nWould you like to walk less/more or more/less transfers?`
                            ]
                        }
                    }]
                });
            }
        }

        if (intentName === 'adjust-for-walking') {
            console.log("adjusting for walking")
            const lessWalking = !body.queryResult.parameters['walking'];

            console.log("boolean"+lessWalking)

            const routeContext = contexts.find(context =>
                context.name.endsWith('/contexts/route_requested')
            );

            if (!routeContext?.parameters) {
                throw new RouteError('No active route to adjust', 'NO_ROUTE_CONTEXT');
            }

            console.log("route context:" + routeContext.parameters)

            const destination = routeContext.parameters['destination'] || '';
            const origin = routeContext.parameters['origin'] || '';
            const arrivalTime_full = routeContext.parameters['time_preference'] || { "date_time": new Date().toISOString() };
            const arrivalTime = arrivalTime_full?.date_time || "No arrival time set";

            console.log(`Adjusting route with less walking: ${lessWalking}`);
            const busRoutes = await fetchBusRoutes(origin, destination, arrivalTime, lessWalking);

            if (busRoutes && busRoutes.length > 0) {
                const routeDetails = formatRoutes(busRoutes);

                return NextResponse.json({
                    fulfillmentMessages: [{
                        text: {
                            text: [
                                `I've adjusted the route ${lessWalking ? 'to minimize walking' : 'to maximise walking'}:\n\n${routeDetails}\n\nIs this route better for you?`
                            ]
                        }
                    }]
                });
            }
        }

        if (intentName === 'adjust_for_transfers') {
            console.log("adjusting for walking")
            const lessTransfers = !body.queryResult.parameters['boolean'];

            console.log("boolean"+lessTransfers)

            const routeContext = contexts.find(context =>
                context.name.endsWith('/contexts/route_requested')
            );

            if (!routeContext?.parameters) {
                throw new RouteError('No active route to adjust', 'NO_ROUTE_CONTEXT');
            }

            console.log("route context:" + routeContext.parameters)

            const destination = routeContext.parameters['destination'] || '';
            const origin = routeContext.parameters['origin'] || '';
            const arrivalTime_full = routeContext.parameters['time_preference'] || { "date_time": new Date().toISOString() };
            const arrivalTime = arrivalTime_full?.date_time || "No arrival time set";

            console.log(`Adjusting route with less transfers: ${lessTransfers}`);
            const busRoutes = await fetchBusRoutes(origin, destination, arrivalTime, lessTransfers);

            if (busRoutes && busRoutes.length > 0) {
                const routeDetails = formatRoutes(busRoutes);

                return NextResponse.json({
                    fulfillmentMessages: [{
                        text: {
                            text: [
                                `I've adjusted the route ${lessTransfers ? 'to maximse transfers' : 'to minimize transfers'}:\n\n${routeDetails}\n\nIs this route better for you?`
                            ]
                        }
                    }]
                });
            }
        }

        return NextResponse.json({
            fulfillmentMessages: [{
                text: {
                    text: [
                        `I received your request but I'm not sure how to help with "${intentName || 'unknown intent'}". Could you please rephrase your question?`
                    ]
                }
            }]
        });

    } catch (error) {
        const routeError = error instanceof RouteError ? error :
            new RouteError('Unexpected error', 'UNKNOWN', 500);

        const errorMessages = {
            'INVALID_ORIGIN': 'Please provide a valid origin.',
            'INVALID_DESTINATION': 'Please provide a valid destination.',
            'INVALID_TIME': 'Please provide a valid arrival time.',
            'PAST_TIME': 'Please provide a future arrival time.',
            'NO_ROUTES': 'No routes found. Try a different time or destination.',
            'NO_TRANSIT': 'No bus routes available for this journey.',
            'TIMEOUT': 'Request timed out. Please try again.',
            'AUTH_ERROR': 'Service temporarily unavailable.',
            'INTERNAL_ERROR': 'An error occurred. Please try again later.',
            'UNKNOWN': 'An unexpected error occurred. Please try again.',
        };

        console.error('Webhook Error:', error);

        return NextResponse.json({
            fulfillmentMessages: [{
                text: {
                    text: [
                        errorMessages[routeError.code] || 'An unexpected error occurred. Please try again.'
                    ]
                }
            }]
        }, { status: routeError.status });
    }
}