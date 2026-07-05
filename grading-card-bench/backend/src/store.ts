/**
 * Dead-simple JSON-file persistence for capture sessions, image metadata,
 * lighting profiles and capture sequences. Swap for Postgres/S3 in
 * production — the route layer only touches this interface.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface StoredSession {
  sessionId: string;
  customerId?: string;
  cardId?: string;
  cardType?: string;
  sequenceId: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  state?: unknown; // latest full CaptureSessionState snapshot from the web app
}

export interface StoredImage {
  imageId: string;
  sessionId: string;
  stepId: string;
  accepted: boolean;
  rejectedReason?: string;
  filePath?: string;
  record: unknown;
  metadata: unknown;
  createdAt: string;
}

interface Db {
  sessions: Record<string, StoredSession>;
  images: Record<string, StoredImage>;
  lightingProfiles: Record<string, unknown>;
  captureSequences: Record<string, unknown>;
}

export class JsonStore {
  private db: Db = { sessions: {}, images: {}, lightingProfiles: {}, captureSequences: {} };
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly dataDir: string,
    public readonly imagesDir = path.join(dataDir, "images")
  ) {}

  private get dbPath(): string {
    return path.join(this.dataDir, "db.json");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.imagesDir, { recursive: true });
    try {
      this.db = JSON.parse(await fs.readFile(this.dbPath, "utf8")) as Db;
    } catch {
      // fresh database
    }
    this.loaded = true;
  }

  private persist(): Promise<void> {
    // Serialize writes so concurrent requests can't interleave file writes.
    this.writeQueue = this.writeQueue.then(() =>
      fs.writeFile(this.dbPath, JSON.stringify(this.db, null, 2))
    );
    return this.writeQueue;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("Store not initialized");
  }

  // Sessions -------------------------------------------------------------------
  async upsertSession(session: StoredSession): Promise<StoredSession> {
    this.assertLoaded();
    this.db.sessions[session.sessionId] = session;
    await this.persist();
    return session;
  }

  getSession(sessionId: string): StoredSession | undefined {
    this.assertLoaded();
    return this.db.sessions[sessionId];
  }

  async patchSession(sessionId: string, patch: Partial<StoredSession>): Promise<StoredSession | undefined> {
    const existing = this.getSession(sessionId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, sessionId };
    this.db.sessions[sessionId] = updated;
    await this.persist();
    return updated;
  }

  // Images ----------------------------------------------------------------------
  async upsertImage(image: StoredImage): Promise<StoredImage> {
    this.assertLoaded();
    this.db.images[image.imageId] = image;
    await this.persist();
    return image;
  }

  getImage(imageId: string): StoredImage | undefined {
    this.assertLoaded();
    return this.db.images[imageId];
  }

  listImagesForSession(sessionId: string): StoredImage[] {
    this.assertLoaded();
    return Object.values(this.db.images).filter((i) => i.sessionId === sessionId);
  }

  async patchImage(imageId: string, patch: Partial<StoredImage>): Promise<StoredImage | undefined> {
    const existing = this.getImage(imageId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, imageId };
    this.db.images[imageId] = updated;
    await this.persist();
    return updated;
  }

  // Lighting profiles / capture sequences -------------------------------------------
  listLightingProfiles(): unknown[] {
    this.assertLoaded();
    return Object.values(this.db.lightingProfiles);
  }

  async upsertLightingProfile(id: string, profile: unknown): Promise<void> {
    this.assertLoaded();
    this.db.lightingProfiles[id] = profile;
    await this.persist();
  }

  async deleteLightingProfile(id: string): Promise<boolean> {
    this.assertLoaded();
    const existed = id in this.db.lightingProfiles;
    delete this.db.lightingProfiles[id];
    await this.persist();
    return existed;
  }

  listCaptureSequences(): unknown[] {
    this.assertLoaded();
    return Object.values(this.db.captureSequences);
  }

  async upsertCaptureSequence(id: string, sequence: unknown): Promise<void> {
    this.assertLoaded();
    this.db.captureSequences[id] = sequence;
    await this.persist();
  }
}
