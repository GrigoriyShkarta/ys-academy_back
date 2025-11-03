import { BadRequestException, Injectable } from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type FileType = 'image' | 'video' | 'raw';

@Injectable()
export class FileService {
  async uploadFile(file: Express.Multer.File, type: FileType) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { resource_type: type, folder: `ys_academy/${type}s` },
        (error, result) => {
          if (error) return reject(new BadRequestException(error.message));
          if (!result)
            return reject(
              new BadRequestException(
                'Cloudinary upload returned empty result',
              ),
            );
          resolve(result);
        },
      );
      upload.end(file.buffer);
    });
  }

  async deleteFile(publicId: string, type: FileType): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: type });
  }
}
