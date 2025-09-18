# Obsidian DBML Render Plugin

Render DBML diagrams in your Obsidian notes using the open-source dbml-render library.

<img width="1160" height="661" alt="image" src="https://github.com/user-attachments/assets/b8d69c53-820a-4a84-8ce1-c45beeb80cbe" />

## Usage

Write [DBML](https://dbml.dbdiagram.io/home) code blocks in your notes:

````markdown
```dbml
Table users {
  id int [pk]
  name varchar
}
```
````

## Features
- Render DBML diagrams
- Customizable appearance via settings

## Installation
1. Run `npm run build`
2. Copy the plugin's distribution folder (called `obsidian-dbml-render`) to your Obsidian vault's plugins directory.
3. Enable the plugin in Obsidian settings. 

## via BRAT
1. Navigate to the BRAT plugin settings in Obsidian and click Add Beta Plugin.
2. In the input that appears paste the link for this repo and click Add Plugin.

## Open Source Libraries Used
- [@softwaretechnik/dbml-renderer](https://github.com/softwaretechnik/dbml-renderer) (DBML parsing and rendering)
- [viz.js](https://github.com/mdaines/viz.js) (Graphviz DOT to SVG rendering)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api) (plugin framework)

## License
This plugin is licensed under the MIT License. See the LICENSE file for details. 
