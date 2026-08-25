import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || 'eve-nt';
    
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'eu-central-1', // Dla MinIO to wartość domyślna
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'admin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'SuperSecretPassword123',
      },
      // Wymagane dla Self-hosted MinIO (ścieżki w stylu localhost:9000/bucket zamiast bucket.localhost:9000)
      forcePathStyle: true, 
    });
  }

  /**
   * Zapisuje fizyczny plik w bezpiecznym Object Storage.
   * Multi-tenancy: Pliki lądują w izolowanych ścieżkach np. `org_1/modele_zalaczniki/1684345.pdf`
   */
  async uploadFile(file: Express.Multer.File, id_organizacji: number, folder: string = 'ogolne'): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 10000)}.${fileExtension}`;
    const objectKey = `org_${id_organizacji}/${folder}/${uniqueFileName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return objectKey;
  }

  /**
   * Generuje wygasający link URL do pobrania pliku z S3.
   * Plik nigdy nie jest serwowany publicznie.
   */
  async getPresignedDownloadUrl(objectKey: string, expiresInSeconds: number = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    // Link zniszczy się sam po 5 minutach (300 sekund)
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Fizyczne usunięcie obiektu z chmury S3/MinIO
   */
  async deleteFile(objectKey: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      );
    } catch (error) {
      console.error(`Błąd usuwania pliku [${objectKey}] z S3:`, error);
    }
  }
}