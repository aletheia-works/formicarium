import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
import { defineConfig } from 'astro/config';
import { defineCollection } from 'astro:content';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import type { Session } from '@aletheia-works/formicarium';
