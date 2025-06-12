import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting } from "obsidian";
import { parse } from "@softwaretechnik/dbml-renderer/lib/parser";
import { check } from "@softwaretechnik/dbml-renderer/lib/checker";
import { render as dbmlRender } from "@softwaretechnik/dbml-renderer/lib/renderer";
import Viz from "viz.js";
import { Module, render } from "viz.js/full.render.js";

export default class DbmlRenderPlugin extends Plugin {
  viz: Viz | null = null;

  async onload() {
    this.viz = new Viz({ Module, render });
    this.registerMarkdownCodeBlockProcessor("dbml", this.dbmlProcessor.bind(this));
    this.addSettingTab(new DbmlRenderSettingTab(this.app, this));
  }

  async dbmlProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const container = el.createDiv({ cls: "dbml-render-container" });
    let dot: string;
    try {
      // Parse and check DBML, then generate DOT
      const ast = parse(source);
      const checked = check(ast);
      dot = dbmlRender(checked, "dot");
    } catch (err) {
      container.createEl("pre", { text: `DBML parsing error: ${err}` });
      return;
    }
    try {
      // Render SVG from DOT
      if (!this.viz) {
        this.viz = new Viz({ Module, render });
      }
      const svg = await this.viz.renderSVGElement(dot);
      container.appendChild(svg);
    } catch (err) {
      container.createEl("pre", { text: `DOT/SVG rendering error: ${err}` });
    }
  }
}

class DbmlRenderSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: DbmlRenderPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "DBML Render Settings" });
    // Settings UI will go here
  }
} 