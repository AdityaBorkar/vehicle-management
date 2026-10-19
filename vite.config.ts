import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	build: {
		outDir: ".output",
	},
	envPrefix: "PUBLIC_",
	plugins: [
		devtools(),
		nitro(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		basicSsl(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: 3000,
		strictPort: true,
	},
});

export default config;
