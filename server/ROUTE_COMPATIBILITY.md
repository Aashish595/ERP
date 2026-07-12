# API compatibility

The migration preserves the former frontend-facing paths while moving ownership to Express. FastAPI is private and invoked only through the Express AI routes.

This full version also separates model metadata, repositories, services, controllers, validators, and thin route wiring. See `FULL_BACKEND_STRUCTURE.md`.

| Module | Former route count | New owner |
|---|---:|---|
| Authentication | 9 | Express |
| School and branding | 6 | Express |
| Academic setup | 20 | Express |
| Students and teachers | 23 | Express |
| Dashboard | 2 | Express |
| Notices | 9 | Express persistence; FastAPI generation/enhancement |
| Communication | 17 | Express |
| Attendance | 7 | Express |
| Homework | 10 | Express |
| Timetable | 18 | Express |
| Exams | 22 | Express |
| Fees | 30 | Express |
| Library | 14 | Express |
| Reports | 6 | Express |
| Curriculum | 2 | Express approval; FastAPI generation |
| Meetings | 13 | Express |
| LMS assignments | 9 | Express; FastAPI quiz generation |
| AI chat sessions | 7 | Express session storage; FastAPI response generation |
| Courses | 12 | Express |
| Enrollments | 4 | Express |
| Lessons | 7 | Express storage; FastAPI summary/quiz |
| Progress | 5 | Express |
| Profile | 3 | Express |
| **Total** | **255** | |

An additional `/courses/enrolled` alias is included because the existing quiz page calls it even though the former backend did not expose that path.
