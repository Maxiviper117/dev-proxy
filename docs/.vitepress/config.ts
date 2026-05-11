import { defineConfig } from "vitepress";

export default defineConfig({
  title: "DevProxy",
  description:
    "Windows-native CLI for stable HTTPS local domains that proxy to local development services.",
  base: "/dev-proxy/",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: "https://maxiviper117.github.io/dev-proxy",
  },

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    nav: [
      { text: "Tutorials", link: "/tutorials/" },
      { text: "How-to", link: "/how-to/" },
      { text: "Reference", link: "/reference/" },
      { text: "Explanation", link: "/explanation/" },
      { text: "Development", link: "/development/contributing" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/@maxiviper117/devproxy",
      },
    ],

    sidebar: {
      "/tutorials/": [
        {
          text: "Tutorials",
          collapsed: false,
          items: [
            { text: "Overview", link: "/tutorials/" },
            { text: "Get Started", link: "/tutorials/getting-started" },
            { text: "First Project", link: "/tutorials/first-project" },
          ],
        },
      ],
      "/how-to/": [
        {
          text: "How-to",
          collapsed: false,
          items: [
            { text: "Overview", link: "/how-to/" },
            { text: "Install Caddy", link: "/how-to/install-caddy" },
            { text: "Register a Service", link: "/how-to/register-service" },
            { text: "Open Project Targets", link: "/how-to/open-project-targets" },
            { text: "Use Vite", link: "/how-to/use-vite" },
            { text: "Use Express", link: "/how-to/use-express" },
            { text: "Use Laravel", link: "/how-to/use-laravel" },
            { text: "Use Next.js", link: "/how-to/use-nextjs" },
            { text: "Run the Dashboard", link: "/how-to/run-dashboard" },
            { text: "Fix Hosts Drift", link: "/how-to/fix-hosts-drift" },
            { text: "Troubleshoot HTTPS", link: "/how-to/troubleshoot-https" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          collapsed: false,
          items: [
            { text: "Overview", link: "/reference/" },
            { text: "Commands", link: "/reference/commands" },
            { text: "Config", link: "/reference/config" },
            { text: "Files and Paths", link: "/reference/files-and-paths" },
            { text: "Permissions", link: "/reference/permissions" },
          ],
        },
      ],
      "/explanation/": [
        {
          text: "Explanation",
          collapsed: false,
          items: [
            { text: "Overview", link: "/explanation/" },
            { text: "How It Works", link: "/explanation/how-it-works" },
            { text: "HTTPS and Trust", link: "/explanation/https-and-trust" },
            {
              text: "Windows, WSL, and Docker",
              link: "/explanation/windows-wsl-docker",
            },
          ],
        },
      ],
      "/development/": [
        {
          text: "Development",
          collapsed: false,
          items: [{ text: "Contributing", link: "/development/contributing" }],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/Maxiviper117/dev-proxy" }],

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/Maxiviper117/dev-proxy/edit/main/docs/:path",
    },
  },
});
