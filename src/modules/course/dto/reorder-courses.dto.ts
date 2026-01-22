class CourseOrderItem {
  id: number;
  order: number;
}

export class ReorderCoursesDto {
  courses: CourseOrderItem[];
}
