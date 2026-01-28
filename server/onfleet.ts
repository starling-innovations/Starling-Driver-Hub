const ONFLEET_API_KEY = process.env.STARLING_STAGING_API_KEY;
const ONFLEET_BASE_URL = "https://onfleet.com/api/v2";
const DEFAULT_TEAM_ID = "BPFsaTGXIHgF90hxup3XikF2";

interface OnfleetVehicle {
  id?: string;
  type: "CAR" | "MOTORCYCLE" | "BICYCLE" | "TRUCK";
  description?: string;
  licensePlate?: string;
  color?: string;
}

interface OnfleetWorker {
  id: string;
  name: string;
  phone: string;
  teams: string[];
  vehicle?: OnfleetVehicle;
  onDuty?: boolean;
  metadata?: any[];
}

interface CreateWorkerData {
  name: string;
  phone: string;
  teams: string[];
  vehicle?: {
    type: "CAR" | "MOTORCYCLE" | "BICYCLE" | "TRUCK";
    description?: string;
    licensePlate?: string;
    color?: string;
  };
  addresses?: {
    routing: {
      location?: [number, number];
      address: {
        number?: string;
        street?: string;
        apartment?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    };
  };
}

function getAuthHeader(): string {
  if (!ONFLEET_API_KEY) {
    throw new Error("Onfleet API key not configured");
  }
  return "Basic " + Buffer.from(ONFLEET_API_KEY + ":").toString("base64");
}

function formatPhoneForOnfleet(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return "+1" + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return "+" + cleaned;
  }
  return phone;
}

function parseStreetAddress(streetAddress: string): { number: string; street: string } {
  const match = streetAddress.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (match) {
    return { number: match[1], street: match[2] };
  }
  return { number: "", street: streetAddress };
}

async function getCoordinatesFromPlaceId(placeId: string): Promise<[number, number] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("Google Places API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.status === "OK" && data.result?.geometry?.location) {
      const location = data.result.geometry.location;
      return [location.lng, location.lat];
    }
    console.error("Place details lookup failed:", data.status);
    return null;
  } catch (error) {
    console.error("Error getting place coordinates:", error);
    return null;
  }
}

export async function findWorkerByPhone(phone: string): Promise<OnfleetWorker | null> {
  try {
    const formattedPhone = formatPhoneForOnfleet(phone);
    const response = await fetch(
      `${ONFLEET_BASE_URL}/workers?phones=${encodeURIComponent(formattedPhone)}`,
      {
        method: "GET",
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Onfleet API error finding worker:", errorData);
      return null;
    }

    const workers: OnfleetWorker[] = await response.json();
    return workers.length > 0 ? workers[0] : null;
  } catch (error) {
    console.error("Error finding worker by phone:", error);
    return null;
  }
}

export async function createWorker(data: CreateWorkerData): Promise<OnfleetWorker | null> {
  try {
    const response = await fetch(`${ONFLEET_BASE_URL}/workers`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: data.name,
        phone: formatPhoneForOnfleet(data.phone),
        teams: data.teams,
        vehicle: data.vehicle,
        addresses: data.addresses,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Onfleet API error creating worker:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating worker:", error);
    return null;
  }
}

export async function updateWorker(
  workerId: string,
  data: Partial<CreateWorkerData>
): Promise<OnfleetWorker | null> {
  try {
    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name;
    if (data.vehicle) updatePayload.vehicle = data.vehicle;
    if (data.addresses) updatePayload.addresses = data.addresses;

    const response = await fetch(`${ONFLEET_BASE_URL}/workers/${workerId}`, {
      method: "PUT",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Onfleet API error updating worker:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating worker:", error);
    return null;
  }
}

export interface SyncResult {
  success: boolean;
  onfleetId?: string;
  isExisting: boolean;
  error?: string;
}

export async function syncDriverToOnfleet(profile: {
  firstName: string;
  lastName: string;
  phone: string;
  streetAddress?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  googlePlaceId?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  vehicleColor?: string | null;
  licensePlate?: string | null;
}): Promise<SyncResult> {
  if (!profile.phone) {
    return { success: false, isExisting: false, error: "Phone number is required" };
  }

  try {
    const existingWorker = await findWorkerByPhone(profile.phone);

    if (existingWorker) {
      console.log(`Found existing Onfleet worker: ${existingWorker.id}, updating profile...`);
      
      const vehicleDescription = [
        profile.vehicleYear,
        profile.vehicleMake,
        profile.vehicleModel,
      ]
        .filter(Boolean)
        .join(" ");

      const updatePayload: any = {
        name: `${profile.firstName} ${profile.lastName} ONT_STR`,
        vehicle: {
          type: "CAR",
          description: vehicleDescription || undefined,
          licensePlate: profile.licensePlate || undefined,
          color: profile.vehicleColor || undefined,
        },
      };

      if (profile.streetAddress && profile.city && profile.province && profile.postalCode) {
        const addressParts = parseStreetAddress(profile.streetAddress);
        let coordinates: [number, number] | null = null;
        
        if (profile.googlePlaceId) {
          coordinates = await getCoordinatesFromPlaceId(profile.googlePlaceId);
        }
        
        const routingAddress: any = {
          address: {
            number: addressParts.number,
            street: addressParts.street,
            city: profile.city,
            state: profile.province,
            postalCode: profile.postalCode,
            country: "Canada",
          },
        };
        
        if (coordinates) {
          routingAddress.location = coordinates;
        }
        
        updatePayload.addresses = { routing: routingAddress };
      }

      await updateWorker(existingWorker.id, updatePayload);
      
      return {
        success: true,
        onfleetId: existingWorker.id,
        isExisting: true,
      };
    }

    const vehicleDescription = [
      profile.vehicleYear,
      profile.vehicleMake,
      profile.vehicleModel,
    ]
      .filter(Boolean)
      .join(" ");

    const workerData: CreateWorkerData = {
      name: `${profile.firstName} ${profile.lastName} ONT_STR`,
      phone: profile.phone,
      teams: [DEFAULT_TEAM_ID],
      vehicle: {
        type: "CAR",
        description: vehicleDescription || undefined,
        licensePlate: profile.licensePlate || undefined,
        color: profile.vehicleColor || undefined,
      },
    };

    if (profile.streetAddress && profile.city && profile.province && profile.postalCode) {
      const addressParts = parseStreetAddress(profile.streetAddress);
      let coordinates: [number, number] | null = null;
      
      if (profile.googlePlaceId) {
        coordinates = await getCoordinatesFromPlaceId(profile.googlePlaceId);
      }
      
      const routingAddress: any = {
        address: {
          number: addressParts.number,
          street: addressParts.street,
          city: profile.city,
          state: profile.province,
          postalCode: profile.postalCode,
          country: "Canada",
        },
      };
      
      if (coordinates) {
        routingAddress.location = coordinates;
      }
      
      workerData.addresses = { routing: routingAddress };
    }

    const newWorker = await createWorker(workerData);

    if (newWorker) {
      console.log(`Created new Onfleet worker: ${newWorker.id}`);
      return {
        success: true,
        onfleetId: newWorker.id,
        isExisting: false,
      };
    }

    return { success: false, isExisting: false, error: "Failed to create worker in Onfleet" };
  } catch (error) {
    console.error("Error syncing driver to Onfleet:", error);
    return { success: false, isExisting: false, error: String(error) };
  }
}

export { DEFAULT_TEAM_ID };
