import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting } from "obsidian";

export default class DbmlRenderPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("dbml", this.dbmlProcessor.bind(this));
    this.addSettingTab(new DbmlRenderSettingTab(this.app, this));
  }

  async dbmlProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    el.createEl("div", { text: "DBML rendering coming soon..." });
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