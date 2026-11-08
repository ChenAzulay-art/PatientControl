import { Fragment, createElement, type ReactNode } from "react";

/**
 * Like `format`, but the values can be elements (e.g. links inside a
 * translated sentence), so word order stays up to each language.
 */
export function richFormat(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = key && Object.hasOwn(values, key) ? values[key] : part;
    return createElement(Fragment, { key: index }, value);
  });
}
