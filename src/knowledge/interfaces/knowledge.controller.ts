import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DmAuthGuard } from "../../campaigns/interfaces/dm-auth.guard";
import { KnowledgeService } from "../application/knowledge.service";
import {
  ChatKnowledgeDto,
  ImportKnowledgeDto,
  SearchKnowledgeDto,
} from "./dtos";

type UploadedKnowledgeFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller("campaigns/:slug/knowledge")
@UseGuards(DmAuthGuard)
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
  ) {}

  @Post("import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  importDocument(
    @Param("slug") slug: string,
    @Body() dto: ImportKnowledgeDto,
    @UploadedFile() file?: UploadedKnowledgeFile,
  ) {
    if (!file) {
      throw new BadRequestException("Knowledge import requires a file.");
    }

    return this.knowledge.importDocument(slug, {
      ...dto,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      content: file.buffer,
    });
  }

  @Post("import-srd")
  importBundledSrd(@Param("slug") slug: string) {
    return this.knowledge.importBundledSrd(slug);
  }

  @Get("documents")
  listDocuments(@Param("slug") slug: string) {
    return this.knowledge.listDocuments(slug);
  }

  @Delete("documents/:documentId")
  deleteDocument(
    @Param("slug") slug: string,
    @Param("documentId") documentId: string,
  ) {
    return this.knowledge.deleteDocument(slug, documentId);
  }

  @Post("documents/:documentId/reindex")
  reindexDocument(
    @Param("slug") slug: string,
    @Param("documentId") documentId: string,
  ) {
    return this.knowledge.reindexDocument(slug, documentId);
  }

  @Post("rebuild-index")
  rebuildIndex(@Param("slug") slug: string) {
    return this.knowledge.rebuildIndex(slug);
  }

  @Get("search")
  search(@Param("slug") slug: string, @Query() query: SearchKnowledgeDto) {
    return this.knowledge.search(slug, query.q, query.mode, query.sourceType);
  }

  @Post("chat")
  chat(@Param("slug") slug: string, @Body() dto: ChatKnowledgeDto) {
    return this.knowledge.chat(slug, dto.question, dto.mode);
  }

  @Get("attributions")
  attributions(@Param("slug") slug: string) {
    return this.knowledge.attributions(slug);
  }
}
