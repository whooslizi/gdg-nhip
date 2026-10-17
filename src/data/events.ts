import type { Category, EventDetail } from '@/types/api';

export const categories: Category[] = [
  { slug: 'music-concerts', nameEn: 'Music & Concerts', nameVi: 'Âm nhạc & Hòa nhạc' },
  { slug: 'conferences-meetups', nameEn: 'Conferences & Meetups', nameVi: 'Hội thảo & Gặp gỡ' },
  { slug: 'campus', nameEn: 'Campus Events', nameVi: 'Sự kiện sinh viên' },
  {
    slug: 'university-anniversaries',
    nameEn: 'University Anniversaries',
    nameVi: 'Kỷ niệm thành lập trường',
  },
  { slug: 'arts-culture', nameEn: 'Arts & Culture', nameVi: 'Nghệ thuật & Văn hóa' },
  { slug: 'sports', nameEn: 'Sports', nameVi: 'Thể thao' },
  { slug: 'workshops', nameEn: 'Workshops', nameVi: 'Workshop' },
  { slug: 'community', nameEn: 'Community', nameVi: 'Cộng đồng' },
];

const category = (...slugs: string[]) => categories.filter((c) => slugs.includes(c.slug));

const GDG_HUST = {
  slug: 'gdg-hust',
  name: 'GDG-HUST',
  website: 'https://www.facebook.com/gdgoc.hust',
  about:
    'GDG on Campus Hanoi University of Science & Technology (GDGoC-HUST, trước đây là GDSC-HUST) là tổ chức phi lợi nhuận dành cho sinh viên Đại học Bách khoa Hà Nội yêu thích Công nghệ Thông tin. Sứ mệnh của câu lạc bộ là xây dựng một cộng đồng nơi các thành viên cùng phát triển kỹ năng chuyên môn lẫn kỹ năng mềm và cùng nhau trưởng thành.\n\nGDGoC-HUST là nhóm độc lập; hoạt động và quan điểm của nhóm không đại diện cho Google.',
};

const FAMI = {
  slug: 'fami-hust',
  name: 'FAMI – Khoa Toán - Tin, Đại học Bách khoa Hà Nội',
  website: 'https://fami.hust.edu.vn',
  about:
    'Khoa Toán - Tin (FAMI) phụ trách giảng dạy các học phần toán đại cương cho sinh viên toàn trường, trong đó có Giải tích 1 — học phần mà gần như mọi tân sinh viên Bách khoa đều phải vượt qua.',
};

const GDG_HUST_ABOUT_EN =
  'GDG on Campus Hanoi University of Science & Technology (GDGoC-HUST, formerly GDSC-HUST) is a non-profit group for HUST students who love information technology. Its mission is to build a community where members grow both their technical and soft skills, together.\n\nGDGoC-HUST is an independent group; its activities and views do not represent Google.';

const FAMI_ABOUT_EN =
  'The Faculty of Mathematics and Informatics (FAMI) teaches the general mathematics courses for the whole university, including Calculus 1 — the course almost every HUST freshman has to pass.';

const STUDY_CLUB = {
  slug: 'clb-ho-tro-hoc-tap',
  name: 'CLB Hỗ trợ Học tập',
  about:
    'CLB Hỗ trợ Học tập là câu lạc bộ sinh viên Đại học Bách khoa Hà Nội, tổ chức các buổi ôn tập và hỗ trợ học tập cho sinh viên trước các kỳ thi.',
};

const STUDY_CLUB_ABOUT_EN =
  'The Study Support Club is a HUST student club that runs review sessions and study support for students ahead of exams.';

/** Seat-mapped events use the same auditorium layout; `seating` holds their venue name and tiers. */
export interface EventData extends Omit<EventDetail, 'ticketTypes' | 'availableCount'> {
  featured: boolean;
  seating?: { venueName: string; premium: number; standard: number };
}

export const events: EventData[] = [
  {
    id: 'gdg-hust-20-10-bloom-with-us',
    slug: 'gdg-hust-20-10-bloom-with-us',
    title: 'GDG-HUST 20/10 Concert: Bloom with Us',
    summary: 'Đêm nhạc 20/10 của GDG-HUST dành tặng một nửa thế giới.',
    description:
      'Nhân Ngày Phụ nữ Việt Nam 20/10, GDG-HUST mang đến Bloom with Us — một đêm nhạc của sinh viên, dành cho sinh viên. Những tiết mục acoustic, band và dance từ các câu lạc bộ trong trường sẽ cùng gửi lời tri ân tới những bông hoa của Bách khoa.\n\nCửa mở từ 18:00. Vui lòng mang theo thẻ sinh viên hoặc giấy tờ tùy thân khi check-in.',
    en: {
      description:
        "For Vietnamese Women's Day on 20/10, GDG-HUST presents Bloom with Us — a concert by students, for students. Acoustic, band and dance acts from clubs across campus come together to thank the women of Bách khoa.\n\nDoors open at 18:00. Please bring your student card or photo ID for check-in.",
      performers: [
        {
          name: 'HUST student bands',
          bio: 'Bands and dance crews from the arts clubs of Hanoi University of Science and Technology.',
        },
        { name: 'Secret guest', bio: 'To be revealed on the GDG-HUST fanpage before the show.' },
      ],
      organizerAbout: GDG_HUST_ABOUT_EN,
    },
    posterUrl: '/posters/gdg-hust-bloom-with-us.jpg',
    organizer: GDG_HUST,
    performers: [
      {
        name: 'Ban nhạc sinh viên Bách khoa',
        bio: 'Các ban nhạc và nhóm nhảy đến từ những câu lạc bộ nghệ thuật của Đại học Bách khoa Hà Nội.',
      },
      {
        name: 'Khách mời bí mật',
        bio: 'Sẽ được GDG-HUST bật mí trên fanpage trước đêm diễn.',
      },
    ],
    categories: category('music-concerts', 'campus'),
    startAt: '2026-10-20T18:30:00+07:00',
    venue: 'Hội trường C2, Đại học Bách khoa Hà Nội',
    city: 'Hà Nội',
    bookingState: 'OPEN',
    featured: true,
    seating: {
      venueName: 'Hội trường C2, Đại học Bách khoa Hà Nội',
      premium: 250_000,
      standard: 150_000,
    },
  },
  {
    id: 'giai-tich-1-the-liveshow',
    slug: 'giai-tich-1-the-liveshow',
    title: 'GIẢI TÍCH 1 THE LIVESHOW',
    summary: 'Một đêm ôn trọn Giải tích 1 trước kỳ thi cuối kỳ.',
    description:
      'Giới hạn, đạo hàm, tích phân, chuỗi — tất cả trong một đêm. GIẢI TÍCH 1 THE LIVESHOW là buổi ôn tập cuối kỳ do FAMI tổ chức: chữa đề thi các năm, mẹo trình bày bài và phần hỏi đáp trực tiếp với giảng viên.\n\nVé miễn phí, số chỗ có hạn. Mang theo giấy nháp, máy tính cầm tay và tinh thần không bỏ cuộc.',
    en: {
      description:
        'Limits, derivatives, integrals, series — all in one night. CALCULUS 1 THE LIVESHOW is a final-exam review run by FAMI: past exam walkthroughs, tips on writing up your answers and live Q&A with lecturers.\n\nTickets are free and seats are limited. Bring scratch paper, a calculator and a never-give-up attitude.',
      performers: [
        {
          name: 'Lecturers of the Faculty of Mathematics and Informatics',
          bio: 'The people who have graded thousands of Calculus 1 exams and know exactly where you will lose marks.',
        },
      ],
      organizerAbout: FAMI_ABOUT_EN,
    },
    posterUrl: '/posters/giai-tich-1-liveshow.jpg',
    organizer: FAMI,
    performers: [
      {
        name: 'Giảng viên Khoa Toán - Tin',
        bio: 'Những người đã chấm hàng nghìn bài thi Giải tích 1 và biết chính xác bạn sẽ mất điểm ở đâu.',
      },
    ],
    categories: category('campus', 'workshops'),
    startAt: '2026-12-27T18:00:00+07:00',
    venue: 'Hội trường C2, Đại học Bách khoa Hà Nội',
    city: 'Hà Nội',
    bookingState: 'REGISTER',
    featured: true,
    seating: { venueName: 'Hội trường C2, Đại học Bách khoa Hà Nội', premium: 0, standard: 0 },
  },
  {
    id: 'ho-tro-thi-giua-ky-clb-ho-tro-hoc-tap',
    slug: 'ho-tro-thi-giua-ky-clb-ho-tro-hoc-tap',
    title: 'HỖ TRỢ THI GIỮA KỲ CLB HỖ TRỢ HỌC TẬP',
    summary: 'Buổi ôn tập giữa kỳ miễn phí do CLB Hỗ trợ Học tập tổ chức.',
    description:
      'Mùa thi giữa kỳ đã đến! CLB Hỗ trợ Học tập tổ chức buổi ôn tập miễn phí cho các học phần đại cương: tóm tắt kiến thức trọng tâm, chữa đề thi các năm và giải đáp thắc mắc trực tiếp.\n\nVé miễn phí, số chỗ có hạn. Thời gian và địa điểm chi tiết sẽ được cập nhật trên fanpage của CLB.',
    en: {
      description:
        'Midterm season is here! The Study Support Club is hosting a free review session for core first-year courses: key-concept summaries, past exam walkthroughs and live Q&A.\n\nTickets are free and seats are limited. Exact time and room will be announced on the club fanpage.',
      organizerAbout: STUDY_CLUB_ABOUT_EN,
    },
    posterUrl: '/posters/ho-tro-thi-giua-ky.jpg',
    organizer: STUDY_CLUB,
    categories: category('campus', 'workshops'),
    startAt: '2026-11-01T08:00:00+07:00',
    venue: 'Đại học Bách khoa Hà Nội',
    city: 'Hà Nội',
    bookingState: 'REGISTER',
    featured: true,
    seating: { venueName: 'Đại học Bách khoa Hà Nội', premium: 0, standard: 0 },
  },
  {
    id: 'hanoi-university-dentistry-70-years',
    slug: 'hanoi-university-dentistry-70-years',
    title: 'Hanoi University of Dentistry and Stomatology: 70 Years and Counting',
    summary: 'Kỷ niệm 70 năm đào tạo Răng Hàm Mặt tại Hà Nội.',
    description:
      'Lễ kỷ niệm 70 năm xây dựng và phát triển, tôn vinh bảy thập kỷ đào tạo, nghiên cứu và cống hiến của các thế hệ thầy trò ngành Răng Hàm Mặt.',
    en: {
      description:
        'A ceremony marking 70 years of growth, honouring seven decades of teaching, research and service by generations of lecturers and students in dentistry and stomatology.',
    },
    posterUrl: '/posters/dentistry-70-years.jpg',
    organizer: {
      slug: 'hanoi-university-dentistry-stomatology',
      name: 'Hanoi University of Dentistry and Stomatology',
    },
    categories: category('university-anniversaries', 'campus'),
    startAt: '2026-11-20T08:00:00+07:00',
    venue: 'Trung tâm Hội nghị Quốc gia',
    city: 'Hà Nội',
    bookingState: 'COMING_SOON',
    featured: true,
  },
];
