import type { Role } from "@/generated/prisma/enums";

/** First-login guide on Home: a few role-specific steps, each with a link to where it happens. */
export type GuideStep = { text: string; href?: string; link?: string };

const SEARCH: GuideStep = { text: "Find any product, task, order or shipment with Search (⌘K, or the search box in the sidebar)." };

export const GUIDE: Record<Role, { title: string; steps: GuideStep[] }> = {
  IMAGE_DESIGNER: {
    title: "Your image work",
    steps: [
      { text: "Everything waiting on you is here on Home and under Creative → Mine.", href: "/creative?who=mine", link: "Open Creative" },
      { text: "Open a task, read the brief, add your image links, then press “Send for review”." },
      { text: "If a Senior asks for changes, the task comes back under “Needs changes” with their note." },
      { text: "Need more time? Use “Ask for more time” inside the task — your media buyer and the Admins are told." },
      SEARCH,
    ],
  },
  VIDEO_EDITOR: {
    title: "Your video work",
    steps: [
      { text: "Everything waiting on you is here on Home and under Creative → Mine.", href: "/creative?who=mine", link: "Open Creative" },
      { text: "Open a task, read the brief, add your video links, then press “Send for review”." },
      { text: "If a Senior asks for changes, the task comes back under “Needs changes” with their note." },
      { text: "Need more time? Use “Ask for more time” inside the task — your media buyer and the Admins are told." },
      SEARCH,
    ],
  },
  MEDIA_BUYER: {
    title: "Running your products",
    steps: [
      { text: "Creative waiting for you is under “Waiting for my review” — Approve or ask for Changes right in the row." },
      { text: "Write the brief on each product's Image creative tab so the makers know the angle." },
      { text: "Launch and update campaigns on the Meta ads tab; move winners to Ordering." },
      { text: "Products shows your own products first (“My products”).", href: "/products", link: "Open Products" },
      SEARCH,
    ],
  },
  RESEARCHER: {
    title: "Researching products",
    steps: [
      { text: "Add a product from the Research page (or press C).", href: "/research", link: "Open Research" },
      { text: "Fill in the supplier link, prices, weight and Air / Sea, then submit. The SOP checklist is a guide — it doesn't block you." },
      { text: "Anything sent back to you shows up here on Home." },
      SEARCH,
    ],
  },
  REVIEWER: {
    title: "Reviewing",
    steps: [
      { text: "New products to approve or drop are on Research → Pending approval.", href: "/research", link: "Open Research" },
      { text: "Creative work to review is under “Waiting for my review” — Approve or ask for Changes right in the row." },
      { text: "Open History on any product to see who did what and when." },
      SEARCH,
    ],
  },
  SUPPLY_CHAIN: {
    title: "Orders and shipments",
    steps: [
      { text: "Test orders to place are on Home: open one, mark it ordered and set when it arrives." },
      { text: "Every product order creates a shipment — track cost, payment and arrival on Shipments.", href: "/shipments", link: "Open Shipments" },
      { text: "Tasks the team gives you are on the Tasks board.", href: "/tasks", link: "Open Tasks" },
      SEARCH,
    ],
  },
  ADMIN: {
    title: "Running the team",
    steps: [
      { text: "Home → Team shows every product in progress and who it's waiting on.", href: "/dashboard?tab=team", link: "Open Team view" },
      { text: "Unassigned work can be given to someone right in the row on Home." },
      { text: "Decide who can do what on Roles & permissions.", href: "/team/roles", link: "Open Roles" },
      { text: "Open History on any product to see who did what and when." },
      SEARCH,
    ],
  },
  CUSTOMER_SUPPORT: {
    title: "Your tasks",
    steps: [
      { text: "Tasks the team gives you are on the Tasks board, each with a due time.", href: "/tasks", link: "Open Tasks" },
      { text: "Move a task to In progress, then Done, as you work — or open it and change its status." },
      { text: "You get a reminder before each task is due." },
      SEARCH,
    ],
  },
  OFFICE_SECRETARY: {
    title: "Your tasks",
    steps: [
      { text: "Tasks the team gives you are on the Tasks board, each with a due time.", href: "/tasks", link: "Open Tasks" },
      { text: "Move a task to In progress, then Done, as you work — or open it and change its status." },
      { text: "You get a reminder before each task is due." },
      SEARCH,
    ],
  },
};
