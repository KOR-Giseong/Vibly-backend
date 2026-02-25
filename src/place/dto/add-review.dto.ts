import { IsInt, Min, Max, IsString, MinLength, MaxLength } from 'class-validator';

export class AddReviewDto {
  @IsInt({ message: '별점은 정수여야 해요.' })
  @Min(1, { message: '별점은 1점 이상이어야 해요.' })
  @Max(5, { message: '별점은 5점 이하여야 해요.' })
  rating: number;

  @IsString()
  @MinLength(1, { message: '리뷰 내용을 입력해주세요.' })
  @MaxLength(1000, { message: '리뷰는 1000자 이하로 입력해주세요.' })
  body: string;
}
