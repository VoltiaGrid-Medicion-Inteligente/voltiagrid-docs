// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'VoltiaGrid Docs',
  tagline: 'Smart metering platform – Project 04',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://voltiagrid-medicion-inteligente.github.io',
  baseUrl: '/voltiagrid-docs/',

  organizationName: 'VoltiaGrid-Medicion-Inteligente',
  projectName: 'voltiagrid-docs',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-docs/tree/develop/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'VoltiaGrid Docs',
        logo: {
          alt: 'VoltiaGrid logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://github.com/VoltiaGrid-Medicion-Inteligente',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Introduction', to: '/'},
            ],
          },
          {
            title: 'Repositories',
            items: [
              {label: 'voltiagrid-api', href: 'https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-api'},
              {label: 'voltiagrid-data', href: 'https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-data'},
              {label: 'voltiagrid-analytics', href: 'https://github.com/VoltiaGrid-Medicion-Inteligente/voltiagrid-analytics'},
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} VoltiaGrid team. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;