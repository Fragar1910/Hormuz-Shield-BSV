/**
 * Fleet Simulator - Simulates vessel movements and positions
 * Generates realistic vessel routes through risk zones
 */

export interface VesselPosition {
  mmsi: string;
  lat: number;
  lon: number;
  speed: number; // knots
  course: number; // degrees
  timestamp: number;
}

export interface Vessel {
  mmsi: string;
  name: string;
  type: 'tanker' | 'container' | 'bulk-carrier' | 'lng';
  hullValueUsd: number;
  currentPosition: VesselPosition;
  route: VesselPosition[];
  routeIndex: number;
}

/**
 * FleetSimulator manages a fleet of vessels with simulated movement
 */
export class FleetSimulator {
  private vessels: Map<string, Vessel> = new Map();
  private fleetSize: number;

  constructor(fleetSize: number = 50) {
    this.fleetSize = fleetSize;
    console.log('[FleetSimulator] Initializing...');
  }

  /**
   * Initialize fleet with generated vessels
   */
  initializeFleet(): void {
    const fleet: Vessel[] = [];

    const vesselTypes: Array<'tanker' | 'container' | 'bulk-carrier' | 'lng'> =
      ['tanker', 'container', 'bulk-carrier', 'lng'];

    const vesselNames = [
      'Atlantic', 'Pacific', 'Indian', 'Arctic', 'Southern',
      'Neptune', 'Poseidon', 'Triton', 'Oceanus', 'Tethys',
      'Nereus', 'Proteus', 'Phoenix', 'Dragon', 'Eagle',
      'Falcon', 'Hawk', 'Condor', 'Albatross', 'Pelican',
      'Voyager', 'Explorer', 'Navigator', 'Pioneer', 'Endeavor',
      'Discovery', 'Enterprise', 'Venture', 'Odyssey', 'Quest',
      'Horizon', 'Meridian', 'Zenith', 'Aurora', 'Eclipse',
      'Constellation', 'Galaxy', 'Nebula', 'Comet', 'Meteor',
      'Thunder', 'Lightning', 'Storm', 'Tempest', 'Typhoon',
      'Breeze', 'Wind', 'Gale', 'Hurricane', 'Cyclone'
    ];

    const routeGenerators = [
      (mmsi: string) => this.generateHormuzRoute(mmsi),
      (mmsi: string) => this.generateGulfRoute(mmsi),
      (mmsi: string) => this.generateBabRoute(mmsi),
    ];

    for (let i = 0; i < this.fleetSize; i++) {
      const vesselType = vesselTypes[i % vesselTypes.length];
      const mmsi = (300000000 + i).toString(); // Valid MMSI range
      const routeGen = routeGenerators[i % routeGenerators.length];
      const route = routeGen(mmsi);

      fleet.push({
        mmsi,
        name: `MV ${vesselNames[i % vesselNames.length]} ${Math.floor(i / vesselNames.length) + 1}`,
        type: vesselType,
        hullValueUsd: 80_000 + Math.floor(Math.random() * 120_000),
        currentPosition: {
          ...route[0],
          mmsi,
          timestamp: Date.now()
        },
        route,
        routeIndex: 0
      });
    }

    fleet.forEach(vessel => {
      this.vessels.set(vessel.mmsi, vessel);
    });

    console.log(`[FleetSimulator] Fleet initialized with ${this.vessels.size} vessels`);
  }

  /**
   * Update vessel positions (simulates movement)
   */
  updatePositions(): void {
    this.vessels.forEach((vessel) => {
      vessel.routeIndex = (vessel.routeIndex + 1) % vessel.route.length;
      vessel.currentPosition = {
        ...vessel.route[vessel.routeIndex],
        timestamp: Date.now()
      };
    });
  }

  /**
   * Get all vessels
   */
  getVessels(): Vessel[] {
    return Array.from(this.vessels.values());
  }

  /**
   * Get specific vessel
   */
  getVessel(mmsi: string): Vessel | undefined {
    return this.vessels.get(mmsi);
  }

  /**
   * Generate route through Strait of Hormuz
   */
  private generateHormuzRoute(mmsi: string = '300000000'): VesselPosition[] {
    const route: VesselPosition[] = [];

    // Route from Gulf of Oman through Hormuz to Persian Gulf
    const waypoints = [
      { lat: 25.5, lon: 56.5 },
      { lat: 25.8, lon: 56.8 },
      { lat: 26.2, lon: 57.2 },
      { lat: 26.5, lon: 57.8 },
      { lat: 26.8, lon: 58.5 },
      { lat: 27.0, lon: 59.0 }
    ];

    waypoints.forEach((wp, i) => {
      route.push({
        mmsi,
        lat: wp.lat,
        lon: wp.lon,
        speed: 12 + Math.random() * 2,
        course: 90 + Math.random() * 20 - 10,
        timestamp: Date.now() + i * 600000 // 10 min intervals
      });
    });

    return route;
  }

  /**
   * Generate route through Persian Gulf
   */
  private generateGulfRoute(mmsi: string = '300000000'): VesselPosition[] {
    const route: VesselPosition[] = [];

    const waypoints = [
      { lat: 26.0, lon: 56.0 },
      { lat: 26.3, lon: 55.5 },
      { lat: 26.7, lon: 55.0 },
      { lat: 27.2, lon: 54.5 },
      { lat: 27.5, lon: 54.0 }
    ];

    waypoints.forEach((wp, i) => {
      route.push({
        mmsi,
        lat: wp.lat,
        lon: wp.lon,
        speed: 14 + Math.random() * 2,
        course: 270 + Math.random() * 20 - 10,
        timestamp: Date.now() + i * 600000
      });
    });

    return route;
  }

  /**
   * Generate route through Bab el-Mandeb
   */
  private generateBabRoute(mmsi: string = '300000000'): VesselPosition[] {
    const route: VesselPosition[] = [];

    const waypoints = [
      { lat: 12.5, lon: 43.5 },
      { lat: 12.8, lon: 43.7 },
      { lat: 13.2, lon: 44.0 },
      { lat: 13.5, lon: 44.3 },
      { lat: 14.0, lon: 44.8 }
    ];

    waypoints.forEach((wp, i) => {
      route.push({
        mmsi,
        lat: wp.lat,
        lon: wp.lon,
        speed: 10 + Math.random() * 2,
        course: 45 + Math.random() * 20 - 10,
        timestamp: Date.now() + i * 600000
      });
    });

    return route;
  }
}
