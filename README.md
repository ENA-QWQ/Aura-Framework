# Aura Framework

[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/your-repo/aura-framework)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/your-repo/aura-framework/pulls)

Aura Framework 是一个微内核架构的静态站点生成器。

按顺序执行插件管道。数据经过各插件处理后，交给主题层渲染成 HTML。

同一套主题可以复用于博客、文档站、个人主页等不同站点类型。切换时只需替换插件组合并修改配置，主题不需要感知底层数据来源。主题和插件之间没有直接依赖，也不共享接口。

插件和主题的开发文档还在整理，近期会补充完整。

---

Aura Framework is a static site generator with a microkernel architecture.

It executes a pipeline of plugins sequentially. After data is processed by each plugin, it is passed to the theme layer to be rendered into HTML.

The same set of themes can be reused across different site types, such as blogs, documentation sites, personal homepages, and more. When switching between site types, you only need to replace the plugin combination and adjust the configuration—the theme does not need to know where the data comes from. Themes and plugins have no direct dependencies and do not share interfaces.

The development documentation for plugins and themes is still being organized and will be completed in the near future.
