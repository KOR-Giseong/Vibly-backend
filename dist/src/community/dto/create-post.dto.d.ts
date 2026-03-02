import { PostCategory } from '@prisma/client';
export declare class CreatePostDto {
    category: PostCategory;
    title: string;
    body: string;
    imageUrl?: string;
}
