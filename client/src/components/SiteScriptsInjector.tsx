import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

function cloneAsExecutableScript(node: HTMLScriptElement) {
  const script = document.createElement("script");
  for (const attr of Array.from(node.attributes)) {
    script.setAttribute(attr.name, attr.value);
  }
  if (node.textContent) {
    script.textContent = node.textContent;
  }
  return script;
}

function injectHtmlSnippet(target: HTMLElement, html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const inserted: Node[] = [];
  for (const node of Array.from(template.content.childNodes)) {
    if (node instanceof HTMLScriptElement) {
      const script = cloneAsExecutableScript(node);
      target.appendChild(script);
      inserted.push(script);
      continue;
    }
    const cloned = node.cloneNode(true);
    target.appendChild(cloned);
    inserted.push(cloned);
  }

  return () => {
    for (const node of inserted) {
      if (node.parentNode === target) {
        target.removeChild(node);
      }
    }
  };
}

export default function SiteScriptsInjector() {
  const { data } = trpc.site.settings.useQuery();

  useEffect(() => {
    if (!data) return;

    const cleanups: Array<() => void> = [];
    if (data.headScripts?.trim()) {
      cleanups.push(injectHtmlSnippet(document.head, data.headScripts));
    }
    if (data.bodyScripts?.trim()) {
      cleanups.push(injectHtmlSnippet(document.body, data.bodyScripts));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [data?.headScripts, data?.bodyScripts]);

  return null;
}
