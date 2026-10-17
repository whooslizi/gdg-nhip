// All posters are CC0 / public domain; credits are shown as a courtesy. See public/posters/CREDITS.md.
export interface ImageCredit {
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}

const CC0 = {
  license: 'CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

export const imageCredits: Record<string, ImageCredit> = {
  '/posters/gdg-hust-bloom-with-us.jpg': {
    author: 'Yvette de Wit',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Audience_enjoying_a_concert_(Unsplash).jpg',
    ...CC0,
  },
  '/posters/dentistry-70-years.jpg': {
    author: 'Adam Whitlock',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fireworks_over_water_(Unsplash).jpg',
    ...CC0,
  },
  '/posters/ho-tro-thi-giua-ky.jpg': {
    author: 'Gary Todd',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sias_Library_-_Students_Studying_2017.jpg',
    ...CC0,
  },
  '/posters/giai-tich-1-liveshow.jpg': {
    author: 'Tungsten',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Mathematics_lecture_at_the_Helsinki_University_of_Technology.jpg',
    license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
};
