export interface Movie {
  id: number;
  title: string;
  poster?: string;
  year: string;
  rating: string;
  genres: string[];
  description: string;
}

export const MOVIES: Movie[] = [
  { id: 1, title: "Inception", poster: "https://picsum.photos/seed/inception/600/900", year: "2010", rating: "8.8", genres: ["Sci-Fi", "Mind-bending"], description: "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea into the mind of a C.E.O." },
  { id: 2, title: "The Dark Knight", poster: "https://picsum.photos/seed/darkknight/600/900", year: "2008", rating: "9.0", genres: ["Action", "Thriller"], description: "When the menace known as the Joker wreaks havoc on Gotham, Batman must accept one of the greatest psychological tests of his ability to fight injustice." },
  { id: 3, title: "Interstellar", poster: "https://picsum.photos/seed/interstellar/600/900", year: "2014", rating: "8.7", genres: ["Sci-Fi", "Feel-good"], description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival as Earth becomes uninhabitable." },
  { id: 4, title: "Pulp Fiction", poster: "https://picsum.photos/seed/pulpfiction/600/900", year: "1994", rating: "8.9", genres: ["Classic", "Thriller"], description: "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption." },
  { id: 5, title: "Fight Club", poster: "https://picsum.photos/seed/fightclub/600/900", year: "1999", rating: "8.8", genres: ["Mind-bending", "Thriller"], description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more." },
  { id: 6, title: "The Matrix", poster: "https://picsum.photos/seed/matrix/600/900", year: "1999", rating: "8.7", genres: ["Sci-Fi", "Action"], description: "A computer hacker learns about the true nature of his reality and his role in the war against its controllers." },
  { id: 7, title: "Parasite", poster: "https://picsum.photos/seed/parasite/600/900", year: "2019", rating: "8.5", genres: ["Thriller", "Mind-bending"], description: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan." },
  { id: 8, title: "Whiplash", poster: "https://picsum.photos/seed/whiplash/600/900", year: "2014", rating: "8.5", genres: ["Drama", "Feel-good"], description: "A promising young drummer enrolls at a cutthroat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing." },
  { id: 9, title: "The Prestige", poster: "https://picsum.photos/seed/prestige/600/900", year: "2006", rating: "8.5", genres: ["Mind-bending", "Classic"], description: "After a tragic accident, two stage magicians engage in a battle to create the ultimate illusion while sacrificing everything they have." },
  { id: 10, title: "Gladiator", poster: "https://picsum.photos/seed/gladiator/600/900", year: "2000", rating: "8.5", genres: ["Action", "Classic"], description: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery." },
  { id: 11, title: "Shutter Island", poster: "https://picsum.photos/seed/shutter/600/900", year: "2010", rating: "8.2", genres: ["Thriller", "Mind-bending"], description: "Two U.S. Marshals are sent to investigate the disappearance of a murderer who escaped from a hospital for the criminally insane." },
];
