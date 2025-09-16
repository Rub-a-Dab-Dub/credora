import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpfsService } from './ipfs.service';
import { IpfsDocumentService } from './ipfs-document.service';
import { IpfsDocument } from './entities/ipfs-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IpfsDocument])],
  providers: [
    IpfsService, 
    IpfsDocumentService,
    {
      provide: 'IPFS_CLIENTS',
      useFactory: async () => {
        const ipfsModule = await Function('return import("ipfs-http-client")')();
        const { create } = ipfsModule;

        const urls =
          process.env.IPFS_NODE_URLS?.split(',') ??
          [process.env.IPFS_NODE_URL || 'http://localhost:5001'];

        return urls.map((url) => create({ url: url.trim() }));
      },
    }

  ],
  exports: [IpfsService, IpfsDocumentService],
})
export class IpfsModule {}
