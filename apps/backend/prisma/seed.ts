import { PrismaClient, AnimeType, ReleaseStatus, PublicationStatus, SeasonName, AgeRating } from "@prisma/client";

const prisma = new PrismaClient();
const fixturePublishedAt = new Date("2026-01-01T00:00:00.000Z");

const genres = [
  { slug: "action", name: "Action" },
  { slug: "adventure", name: "Adventure" },
  { slug: "comedy", name: "Comedy" },
  { slug: "drama", name: "Drama" },
  { slug: "fantasy", name: "Fantasy" },
  { slug: "science-fiction", name: "Science Fiction" },
];

const studios = [
  { slug: "samren-studio-sample", name: "Samren Studio Sample", description: "A clearly labelled local seed fixture." },
];

const animeFixtures = [
  {
    slug: "the-clockwork-orbit",
    title: "The Clockwork Orbit",
    englishTitle: "The Clockwork Orbit",
    nativeTitle: null,
    synopsis: "A young cartographer charts forgotten routes between drifting cities in a quiet, clockwork world.",
    type: AnimeType.TV,
    releaseStatus: ReleaseStatus.FINISHED,
    releaseYear: 2025,
    releaseSeason: SeasonName.FALL,
    ageRating: AgeRating.PG_13,
    score: 82,
    featured: true,
    genres: ["Adventure", "Fantasy"],
  },
  {
    slug: "after-the-blue-hour",
    title: "After the Blue Hour",
    englishTitle: null,
    nativeTitle: null,
    synopsis: "Two classmates rebuild an abandoned observatory and discover a shared language in the night sky.",
    type: AnimeType.TV,
    releaseStatus: ReleaseStatus.FINISHED,
    releaseYear: 2024,
    releaseSeason: SeasonName.SPRING,
    ageRating: AgeRating.PG,
    score: 78,
    featured: true,
    genres: ["Drama", "Science Fiction"],
  },
  {
    slug: "paper-moon-delivery",
    title: "Paper Moon Delivery",
    englishTitle: null,
    nativeTitle: null,
    synopsis: "A cheerful courier carries unusual parcels through a city where every district keeps a different kind of time.",
    type: AnimeType.MOVIE,
    releaseStatus: ReleaseStatus.FINISHED,
    releaseYear: 2023,
    releaseSeason: SeasonName.WINTER,
    ageRating: AgeRating.G,
    score: 86,
    featured: false,
    genres: ["Adventure", "Comedy"],
  },
];

async function main() {
  for (const genre of genres) {
    await prisma.genre.upsert({ where: { slug: genre.slug }, update: {}, create: genre });
  }

  for (const studio of studios) {
    await prisma.studio.upsert({ where: { slug: studio.slug }, update: {}, create: studio });
  }

  const season = await prisma.season.upsert({
    where: { year_season: { year: 2025, season: SeasonName.FALL } },
    update: {},
    create: { year: 2025, season: SeasonName.FALL, label: "Fall 2025 — sample fixture" },
  });

  for (const fixture of animeFixtures) {
    const { genres: genreNames, ...data } = fixture;
    await prisma.anime.upsert({
      where: { slug: fixture.slug },
      update: {},
      create: {
        ...data,
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt: fixturePublishedAt,
        seasonGroup: fixture.slug === "the-clockwork-orbit" ? { connect: { id: season.id } } : undefined,
        genres: {
          create: genreNames.map((name) => ({
            genre: { connect: { name } },
          })),
        },
        studios: {
          create: [{ studio: { connect: { slug: "samren-studio-sample" } } }],
        },
      },
    });
  }

  process.stdout.write("Seeded deterministic local catalogue fixtures. Existing records were not overwritten.\n");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Catalogue seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
