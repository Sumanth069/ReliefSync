/**
 * Hybrid Logical Clock (HLC)
 * Guarantees monotonic causality across distributed offline nodes
 * Format: <wall_ms_15_digits>-<counter_5_digits>-<nodeId>
 */

export class HLC {
  private wall: number = 0;
  private counter: number = 0;
  private node: string;

  constructor(node: string) {
    this.node = node;
  }

  public now(phys: number = Date.now()): string {
    if (phys > this.wall) {
      this.wall = phys;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return this.format();
  }

  public receive(remoteHlc: string, phys: number = Date.now()): string {
    const parsed = HLC.parse(remoteHlc);
    if (!parsed) {
      return this.now(phys);
    }

    const { wall: remoteWall, counter: remoteCounter } = parsed;
    const maxWall = Math.max(this.wall, remoteWall, phys);

    if (maxWall === this.wall && maxWall === remoteWall) {
      this.counter = Math.max(this.counter, remoteCounter) + 1;
    } else if (maxWall === this.wall) {
      this.counter++;
    } else if (maxWall === remoteWall) {
      this.counter = remoteCounter + 1;
    } else {
      this.counter = 0;
    }

    this.wall = maxWall;
    return this.format();
  }

  public static parse(hlcString: string): { wall: number; counter: number; node: string } | null {
    const parts = hlcString.split('-');
    if (parts.length < 3) return null;
    const wall = parseInt(parts[0], 10);
    const counter = parseInt(parts[1], 10);
    const node = parts.slice(2).join('-');
    if (isNaN(wall) || isNaN(counter)) return null;
    return { wall, counter, node };
  }

  public static compare(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  private format(): string {
    const wallStr = String(this.wall).padStart(15, '0');
    const countStr = String(this.counter).padStart(5, '0');
    return `${wallStr}-${countStr}-${this.node}`;
  }
}

/**
 * Generates a collision-resistant, sortable ID using timestamp prefix
 */
export function generateUUIDv7(): string {
  const timestamp = Date.now();
  const hexTime = timestamp.toString(16).padStart(12, '0');
  const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  return `${hexTime}-${randomPart}`;
}
