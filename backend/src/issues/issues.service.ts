import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Issue {
  id: string;
  roomId: string;
  type: string;
  note: string;
  createdAt: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'issues.json');
const MAX_ISSUES = 500; // keep the file bounded

@Injectable()
export class IssuesService implements OnModuleInit {
  private issues: Issue[] = [];

  onModuleInit() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) this.issues = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      this.issues = [];
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.issues, null, 2), 'utf-8');
    } catch (e) {
      console.error('[IssuesService] Failed to save issues.json:', e);
    }
  }

  create(roomId: string, type: string, note: string): Issue {
    const issue: Issue = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      type,
      note,
      createdAt: new Date().toISOString(),
    };
    this.issues.unshift(issue);
    if (this.issues.length > MAX_ISSUES) this.issues.length = MAX_ISSUES;
    this.save();
    return issue;
  }

  findAll(): Issue[] {
    return [...this.issues];
  }

  remove(id: string): void {
    this.issues = this.issues.filter((i) => i.id !== id);
    this.save();
  }
}
