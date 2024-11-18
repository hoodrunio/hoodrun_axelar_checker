import { AppDb } from "@/database/database";

export class AmplifierEventHandler {
    constructor(private db: AppDb) {}
  
    async handlePollStarted(event: any) {
      const { pollRepo } = this.db;
      // Poll başlangıç verilerini işle
    }
  
    async handlePollCompleted(event: any) {
      const { pollRepo } = this.db;
      // Poll tamamlanma verilerini işle
    }
  
    async handleSigningStarted(event: any) {
      const { signatureRepo } = this.db;
      // Signature başlangıç verilerini işle
    }
  
    async handleSigningCompleted(event: any) {
      const { signatureRepo } = this.db;
      // Signature tamamlanma verilerini işle
    }
  }