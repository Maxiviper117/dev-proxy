import { defineConfig } from "vitepress";

export default defineConfig({
  title: "DevProxy",
  description:
    "Windows-native CLI for stable HTTPS local domains that proxy to WSL development services.",
  base: "/dev-proxy/",
  cleanUrls: true,
  lastUpdated: true,

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Examples", link: "/examples/" },
      { text: "Development", link: "/development/contributing" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/@maxiviper117/devproxy",
      },
    ],

    sidebar: [
      {
        text: "Guide",
        collapsed: false,
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Commands", link: "/guide/commands" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Examples",
        collapsed: false,
        items: [
          { text: "Overview", link: "/examples/" },
          { text: "Laravel", link: "/examples/laravel" },
          { text: "Vite", link: "/examples/vite" },
          { text: "Express.js", link: "/examples/express" },
          { text: "Next.js", link: "/examples/nextjs" },
        ],
      },
      {
        text: "Development",
        collapsed: false,
        items: [{ text: "Contributing", link: "/development/contributing" }],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/Maxiviper117/dev-proxy" }],

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/Maxiviper117/dev-proxy/edit/main/docs/:path",
    },
  },
});
