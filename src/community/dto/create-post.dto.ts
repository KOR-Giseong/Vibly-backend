import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PostCategory } from '@prisma/client';

export class CreatePostDto {
  @IsEnum(PostCategory)
  category: PostCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
