import { Controller, Get, Put, Body, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CalendarService } from '../calendar/calendar.service';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json');
const ENV_FILE = path.join(process.cwd(), '.env');

const DEFAULT_PRESET_NAMES = ['Kovács Péter', 'Nagy Anna', 'Horváth Béla', 'Kiss Eszter'];

function readConfig(): { presetNames: string[] } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return { presetNames: DEFAULT_PRESET_NAMES };
}

function writeConfig(data: { presetNames: string[] }) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function decodeTokenExpiry(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

function updateEnvToken(token: string) {
  try {
    let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
    if (/^GRAPH_TEMP_TOKEN=/m.test(content)) {
      content = content.replace(/^GRAPH_TEMP_TOKEN=.*/m, `GRAPH_TEMP_TOKEN=${token}`);
    } else {
      content = content.trimEnd() + `\nGRAPH_TEMP_TOKEN=${token}\n`;
    }
    fs.writeFileSync(ENV_FILE, content, 'utf-8');
  } catch (e) {
    console.error('[AppConfig] Could not update .env:', e);
  }
}

@Controller('api/config')
export class AppConfigController {
  constructor(private readonly calendarService: CalendarService) {}

  // ── Graph token ─────────────────────────────────────────────────────────────

  @Get('graph-token/status')
  getTokenStatus() {
    const token = process.env.GRAPH_TEMP_TOKEN ?? '';
    if (!token) return { hasToken: false, expiresAt: null };
    return { hasToken: true, expiresAt: decodeTokenExpiry(token) };
  }

  @Put('graph-token')
  updateToken(@Body() body: { token: string }) {
    if (!body?.token?.trim()) throw new BadRequestException('token is required');
    const token = body.token.trim();

    // Update in-memory token on the running service (no-op in mock mode)
    this.calendarService.updateToken(token);

    // Update process env so the next request reads it
    process.env.GRAPH_TEMP_TOKEN = token;

    // Persist to .env so the token survives a backend restart
    updateEnvToken(token);

    return { success: true, expiresAt: decodeTokenExpiry(token) };
  }

  // ── Preset names ─────────────────────────────────────────────────────────────

  @Get('preset-names')
  getPresetNames(): string[] {
    return readConfig().presetNames;
  }

  @Put('preset-names')
  setPresetNames(@Body() body: { names: string[] }): string[] {
    if (!Array.isArray(body?.names)) throw new BadRequestException('names must be an array');
    const names = body.names.map(n => String(n).trim()).filter(Boolean);
    const config = readConfig();
    config.presetNames = names;
    writeConfig(config);
    return names;
  }
}
