import React, { type ReactElement, type ReactNode } from "react";
import { IntlMessageFormat, type Formats } from "intl-messageformat";
import escapeHtml from "escape-html";
import invariant from "invariant";
import merge from "lodash.merge";
import * as constants from "./constants";

export type ReactIntlUniversalLocaleData = Record<string, any>;
export type ReactIntlUniversalLocaleMap = Record<string, ReactIntlUniversalLocaleData>;
export type ReactIntlUniversalVariables = Record<string, any>;
export type ReactIntlUniversalWarningHandler = (...msg: any[]) => void;
export type ReactIntlUniversalIntlGetHook = (key: string, currentLocale: string | null) => void;
export type ReactIntlUniversalPrimitiveMessageValue = string | number | bigint | boolean | null | undefined | Date;
export type ReactIntlUniversalPrimitiveMessageVariables = Record<string, ReactIntlUniversalPrimitiveMessageValue>;
// A rich tag formatter maps the translated tag body to a React node, e.g.
// "<link>docs</link>" with { link: chunks => <a>{chunks}</a> }.
export type ReactIntlUniversalRichTagFormatter = (chunks: ReactNode[]) => ReactNode;
export type ReactIntlUniversalRichMessageValue =
  ReactIntlUniversalPrimitiveMessageValue | ReactIntlUniversalRichTagFormatter;
export type ReactIntlUniversalRichMessageVariables = Record<string, ReactIntlUniversalRichMessageValue>;
// Keep the old string return type for ordinary values, and return rich chunks only
// when at least one value is a rich tag formatter function.
export type ReactIntlUniversalIntlMessageResult<TValues extends Record<string, unknown>> =
  Extract<TValues[keyof TValues], ReactIntlUniversalRichTagFormatter> extends never
    ? string
    : ReactIntlUniversalRichMessageResult;

interface ReactIntlUniversalRichMessageDefaultMessageMethods {
  defaultMessage(msg?: string): ReactIntlUniversalRichMessageResult;
  d(msg?: string): ReactIntlUniversalRichMessageResult;
}

export type ReactIntlUniversalRichMessageResult =
  ReactNode[] & ReactIntlUniversalRichMessageDefaultMessageMethods;
export type ReactIntlUniversalFormattedMessage = string | ReactIntlUniversalRichMessageResult;

export interface ReactIntlUniversalOptions {
  currentLocale?: string | null;
  locales?: ReactIntlUniversalLocaleMap;
  warningHandler?: ReactIntlUniversalWarningHandler;
  escapeHtml?: boolean;
  fallbackLocale?: string | null;
  debug?: boolean;
  dataKey?: string;
  formats?: Partial<Formats>;
  intlGetHook?: ReactIntlUniversalIntlGetHook;
  urlLocaleKey?: string;
  cookieLocaleKey?: string;
  localStorageLocaleKey?: string;
  commonLocaleDataUrls?: Record<string, string>;
}

export interface ReactIntlUniversalResolvedOptions {
  currentLocale: string | null;
  locales: ReactIntlUniversalLocaleMap;
  warningHandler: ReactIntlUniversalWarningHandler;
  escapeHtml: boolean;
  fallbackLocale: string | null;
  debug: boolean;
  dataKey: string;
  formats?: Partial<Formats>;
  intlGetHook?: ReactIntlUniversalIntlGetHook;
  urlLocaleKey?: string;
  cookieLocaleKey?: string;
  localStorageLocaleKey?: string;
  commonLocaleDataUrls?: Record<string, string>;
}

export interface ReactIntlUniversalMessageDescriptor {
  id: string;
  defaultMessage?: string;
}

export interface ReactIntlUniversalHTMLMessageDescriptor {
  id: string;
  defaultMessage?: string | ReactElement;
}

interface ReactIntlUniversalElementDefaultMessageMethods {
  defaultMessage(msg?: string | ReactElement): ReactElement;
  d(msg?: string | ReactElement): ReactElement;
}

export type ReactIntlUniversalHTMLMessage =
  string | (ReactElement & ReactIntlUniversalElementDefaultMessageMethods);

// The source is carried through formatting so get(...).d(...) can know whether
// the locale message won and the default message should be ignored.
type MessageSource = "currentLocale" | "fallbackLocale" | "missing";

interface ResolvedMessageSource {
  key: string;
  locale: string | null;
  message: any;
  source: MessageSource;
  keyExists: boolean;
}

interface MessageFormatResult {
  value: ReactIntlUniversalFormattedMessage;
  source: ResolvedMessageSource;
}

interface RichMessageContext {
  instance: ReactIntlUniversal;
  key: string;
  variables?: ReactIntlUniversalVariables;
  keyExists: boolean;
}

interface MissingMessageContext {
  instance: ReactIntlUniversal;
  key: string;
  variables?: ReactIntlUniversalVariables;
}

interface AstElement {
  type?: number;
  value?: unknown;
  children?: AstElement[];
  options?: Record<string, { value?: AstElement[] }>;
}

// get("missing") returns an empty string for backward compatibility. Store the
// key and variables briefly so the chained empty-string .d(...) call can format
// the fallback message with the same ICU/rich-text rules.
let missingMessageContext: MissingMessageContext | null = null;

function setMissingMessageContext(context: MissingMessageContext): void {
  missingMessageContext = context;
}

function clearMissingMessageContext(): void {
  missingMessageContext = null;
}

function isRichMessageResult(value: unknown): value is ReactIntlUniversalRichMessageResult {
  return Array.isArray(value) && typeof (value as Partial<ReactIntlUniversalRichMessageResult>).defaultMessage === "function";
}

declare global {
  interface Navigator {
    userLanguage?: string;
  }

  interface String {
    defaultMessage(msg?: string): string;
    defaultMessage<T extends ReactElement>(msg: T): string | T;
    defaultMessage(msg: string | ReactElement): string | ReactElement;
    d(msg?: string): string;
    d<T extends ReactElement>(msg: T): string | T;
    d(msg: string | ReactElement): string | ReactElement;
  }
}

function stringDefaultMessage<T extends string | ReactElement>(
  this: string | String,
  msg?: T
): string | T | ReactIntlUniversalRichMessageResult {
  const currentMessage = this.toString();
  if (currentMessage) {
    // A real locale/fallback-locale message always wins over .d(...).
    return currentMessage;
  }

  if (typeof msg === "string" || msg instanceof String) {
    const context = missingMessageContext;
    clearMissingMessageContext();
    if (context) {
      return context.instance._formatDefaultMessageFallback(
        context.key,
        msg.toString(),
        context.variables
      );
    }
  }

  clearMissingMessageContext();
  return msg || "";
}

String.prototype.defaultMessage = stringDefaultMessage as String["defaultMessage"];
String.prototype.d = stringDefaultMessage as String["d"];

class ReactIntlUniversal {
  options: ReactIntlUniversalResolvedOptions;

  constructor() {
    this.options = {
      currentLocale: null, // Current locale such as 'en-US'
      locales: {}, // app locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
      warningHandler: function warn(...msg: any[]) { console.warn(...msg) }, // ability to accumulate missing messages using third party services
      escapeHtml: true, // disable escape html in variable mode
      fallbackLocale: null, // Locale to use if a key is not found in the current locale
      debug: false, // If debugger mode is on, the message will be wrapped by a span
      dataKey: 'data-i18n-key', // If debugger mode is on, the message will be wrapped by a span with this data key
    };
  }

  /**
   * Get the formatted message by key
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns message
   */
  _resolveMessageSource(key: string): ResolvedMessageSource {
    if (this.options.intlGetHook) {
      try {
        this.options.intlGetHook(key, this.options.currentLocale);
      } catch (e) {
        console.log('intl get hook error: ', e);
      }
    }
    invariant(key, "key is required");
    const { locales, currentLocale } = this.options;

    // 1. check if the locale data and key exists
    if (!currentLocale || !locales || !locales[currentLocale]) {
      let errorMsg = `react-intl-universal locales data "${currentLocale}" not exists.`;
      if (!currentLocale) {
        errorMsg += `Check if the key "${key}" is used before it is initialized. More info: https://github.com/alibaba/react-intl-universal/issues/144#issuecomment-1345193138`;
      }
      this.options.warningHandler(errorMsg);
      return {
        key,
        locale: currentLocale,
        message: "",
        source: "missing",
        keyExists: false,
      };
    }
    let msg = this.getDescendantProp(locales[currentLocale], key);
    let source: MessageSource = "currentLocale";
    let locale = currentLocale;
    if (msg == null) {
      if (this.options.fallbackLocale) {
        msg = this.getDescendantProp(locales[this.options.fallbackLocale], key);
        source = "fallbackLocale";
        locale = this.options.fallbackLocale;
        if (msg == null) {
          this.options.warningHandler(
            `react-intl-universal key "${key}" not defined in ${currentLocale} or the fallback locale, ${this.options.fallbackLocale}`
          );
          return {
            key,
            locale: currentLocale,
            message: "",
            source: "missing",
            keyExists: false,
          };
        }
      } else {
        this.options.warningHandler(
          `react-intl-universal key "${key}" not defined in ${currentLocale}`
        );
        return {
          key,
          locale: currentLocale,
          message: "",
          source: "missing",
          keyExists: false,
        };
      }
    }

    return {
      key,
      locale,
      message: msg,
      source,
      keyExists: true,
    };
  }

  _getFormattedMessageResult(
    key: string,
    variables?: ReactIntlUniversalVariables,
    options: { forcePlain?: boolean } = {}
  ): MessageFormatResult {
    const source = this._resolveMessageSource(key);
    if (!source.keyExists) {
      return { value: "", source };
    }

    const value = options.forcePlain
      ? this._formatPlainMessage(key, source.message, variables)
      : this._formatMessage(key, source.message, variables);

    return { value, source };
  }

  _getFormattedMessage(key: string, variables?: ReactIntlUniversalVariables): ReactIntlUniversalFormattedMessage {
    return this._getFormattedMessageResult(key, variables).value;
  }

  _formatMessage(
    key: string,
    msg: any,
    variables?: ReactIntlUniversalVariables
  ): ReactIntlUniversalFormattedMessage {
    const richResult = this._tryFormatRichMessage(key, msg, variables);
    if (richResult) {
      return richResult;
    }
    return this._formatPlainMessage(key, msg, variables);
  }

  _formatPlainMessage(
    key: string,
    msg: any,
    variables?: ReactIntlUniversalVariables,
    options: { defaultMessage?: boolean } = {}
  ): string {
    // 2. handle security issue for variables
    if (variables) {
      variables = Object.assign({}, variables);
      // HTML message with variables. Escape it to avoid XSS attack.
      for (let i in variables) {
        let value = variables[i];
        if (
          this.options.escapeHtml === true &&
          (typeof value === "string" || value instanceof String) &&
          value.indexOf("<") >= 0
        ) {
          value = escapeHtml(value.toString());
        }
        variables[i] = value;
      }
    }

    // 3. resolve variables
    try {
      let finalMsg;
      if (variables) { // format message with variables
        // Plain formatting must not interpret rich tags as formatter tags.
        // getHTML also uses this path so legacy HTML strings stay as strings.
        const msgFormatter = new IntlMessageFormat(this._escapeHtmlTagApostrophes(String(msg)), this.options.currentLocale || undefined, this.options.formats, {
          ignoreTag: true
        });
        finalMsg = msgFormatter.format(variables);
      } else { // no variables, just return the message
        finalMsg = msg;
      }
      return finalMsg as string;
    } catch (err) {
      this.options.warningHandler(
        options.defaultMessage
          ? `react-intl-universal format default message failed for key='${key}'.`
          : `react-intl-universal format message failed for key='${key}'.`,
        err instanceof Error ? err.message : String(err)
      );
      return msg as string;
    }
  }

  // Legacy HTML strings often use single-quoted attributes. Escape those
  // apostrophes before ICU parsing so placeholders after the attribute still work.
  _escapeHtmlTagApostrophes(msg: string): string {
    return msg.replace(/<\/?[A-Za-z][^<>]*>/g, (tag) => tag.replace(/'/g, "''"));
  }

  _formatDefaultMessageFallback(
    key: string,
    msg: string,
    variables?: ReactIntlUniversalVariables
  ): string | ReactIntlUniversalRichMessageResult {
    // Missing-key fallback uses the same formatting path as locale messages.
    // This keeps .d("Hello, {name}") consistent with locale data.
    const richResult = this._tryFormatRichMessage(key, msg, variables);
    if (richResult) {
      return richResult;
    }
    return this._formatPlainMessage(key, msg, variables, { defaultMessage: true });
  }

  _tryFormatRichMessage(
    key: string,
    msg: any,
    variables?: ReactIntlUniversalVariables
  ): ReactIntlUniversalRichMessageResult | null {
    // Only formatter functions opt into rich text. React elements passed as
    // ordinary {placeholder} values are intentionally treated as unsupported.
    if (!variables || !this._hasFormatterFunction(variables)) {
      return null;
    }

    let formatter: IntlMessageFormat;
    try {
      formatter = new IntlMessageFormat(String(msg), this.options.currentLocale || undefined, this.options.formats);
    } catch (err) {
      this._warnRichFormatFailure(key, err);
      return null;
    }

    // intl-messageformat only calls formatter values for real tags. Inspect the
    // AST first so unmatched tags can fall back to plain formatting instead of
    // throwing during render.
    const tagNames = this._getRichTagNames(formatter.getAst() as AstElement[]);
    if (tagNames.length === 0) {
      return null;
    }

    const unmatchedTags = tagNames.filter((tagName) => typeof variables[tagName] !== "function");
    if (unmatchedTags.length > 0) {
      this.options.warningHandler(
        `react-intl-universal rich text message contains unmatched tag(s) for key='${key}'.`,
        unmatchedTags.join(", ")
      );
      return null;
    }

    try {
      const formatted = formatter.format<ReactNode>(variables);
      return this._normalizeRichMessageResult(key, formatted, variables, true);
    } catch (err) {
      this._warnRichFormatFailure(key, err);
      return null;
    }
  }

  _hasFormatterFunction(variables: ReactIntlUniversalVariables): boolean {
    return Object.keys(variables).some((key) => typeof variables[key] === "function");
  }

  _getRichTagNames(ast: AstElement[]): string[] {
    const tagNames = new Set<string>();
    const visit = (element: AstElement): void => {
      if (element.type === 8 && typeof element.value === "string") {
        tagNames.add(element.value);
      }

      if (Array.isArray(element.children)) {
        element.children.forEach(visit);
      }

      if (element.options) {
        Object.keys(element.options).forEach((optionKey) => {
          const option = element.options?.[optionKey];
          if (Array.isArray(option?.value)) {
            option.value.forEach(visit);
          }
        });
      }
    };

    ast.forEach(visit);
    return Array.from(tagNames);
  }

  _normalizeRichMessageResult(
    key: string,
    value: string | ReactNode | ReactNode[],
    variables: ReactIntlUniversalVariables | undefined,
    keyExists: boolean
  ): ReactIntlUniversalRichMessageResult {
    const chunks = (Array.isArray(value) ? value : [value]) as ReactNode[];
    return this._attachRichMessageHelpers(chunks, {
      instance: this,
      key,
      variables,
      keyExists,
    });
  }

  _attachRichMessageHelpers(
    chunks: ReactNode[],
    context: RichMessageContext
  ): ReactIntlUniversalRichMessageResult {
    const result = chunks as ReactIntlUniversalRichMessageResult;
    const defaultMessage = (msg?: string): ReactIntlUniversalRichMessageResult => {
      if (context.keyExists || msg == null) {
        return result;
      }

      const formatted = context.instance._formatDefaultMessageFallback(
        context.key,
        msg,
        context.variables
      );
      if (isRichMessageResult(formatted)) {
        return formatted;
      }
      return context.instance._normalizeRichMessageResult(
        context.key,
        formatted,
        context.variables,
        false
      );
    };

    Object.defineProperties(result, {
      // Match the existing chainable API without making these helper methods
      // visible when React iterates the chunks array.
      defaultMessage: {
        value: defaultMessage,
        enumerable: false,
        configurable: true,
      },
      d: {
        value: defaultMessage,
        enumerable: false,
        configurable: true,
      },
    });

    return result;
  }

  _warnRichFormatFailure(key: string, err: unknown): void {
    this.options.warningHandler(
      `react-intl-universal rich format message failed for key='${key}'.`,
      err instanceof Error ? err.message : String(err)
    );
  }

  /**
   * Get the formatted message by key
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns message
   */
  get(key: string): string;
  get(key: string, variables: ReactIntlUniversalPrimitiveMessageVariables): string;
  // This non-generic overload gives inline rich tag formatter functions a
  // contextual chunks type while preserving string returns for primitive values.
  get(key: string, variables: ReactIntlUniversalRichMessageVariables): ReactIntlUniversalRichMessageResult;
  get(key: string, variables: ReactIntlUniversalVariables): string;
  get(key: string, variables?: ReactIntlUniversalVariables): ReactIntlUniversalFormattedMessage {
    clearMissingMessageContext();
    const result = this._getFormattedMessageResult(key, variables);
    if (!result.source.keyExists) {
      // The next chained string .d(...) call will consume this context.
      setMissingMessageContext({ instance: this, key, variables });
      return "";
    }

    const msg = result.value;
    if (isRichMessageResult(msg)) {
      return this.options.debug ? this._getRichSpanElementMessage(key, msg, variables, true) : msg;
    }

    return (this.options.debug ? this._getSpanElementMessage(key, msg) : msg) as unknown as string;
  }

  /**
   * Get the formatted html message by key.
   * @deprecated Use get(...) as the unified API for plain strings, HTML strings,
   * and rich React component interpolation. getHTML remains available for legacy
   * HTML-string rendering.
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns html message
   */
  getHTML(key: string, variables?: ReactIntlUniversalVariables): ReactIntlUniversalHTMLMessage {
    clearMissingMessageContext();
    // getHTML is legacy string-HTML rendering. Force plain mode so rich tag
    // formatter functions are not interpreted as React components here.
    const result = this._getFormattedMessageResult(key, variables, { forcePlain: true });
    if (!result.source.keyExists) {
      // Preserve getHTML("missing").d(<span />) behavior.
      setMissingMessageContext({ instance: this, key, variables });
      return "";
    }

    const msg = result.value;
    if (msg) {
      return this._getSpanElementMessage(key, msg as string);
    }
    return "";
  }

  /**
   * As same as get(...) API
   * @param messageDescriptor options
   * @param variables Variables in message
   * @returns message
   */
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor
  ): string;
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor,
    variables: ReactIntlUniversalPrimitiveMessageVariables
  ): string;
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor,
    variables: ReactIntlUniversalRichMessageVariables
  ): ReactIntlUniversalRichMessageResult;
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor,
    variables: ReactIntlUniversalVariables
  ): string;
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor,
    variables?: ReactIntlUniversalVariables
  ): ReactIntlUniversalFormattedMessage {
    const { id, defaultMessage } = messageDescriptor;
    // Delegate to get(...).defaultMessage(...) so descriptor and chain APIs keep
    // identical missing-key and rich-text fallback behavior.
    const message = variables === undefined ? this.get(id) : this.get(id, variables);
    return (message as ReactIntlUniversalFormattedMessage).defaultMessage(defaultMessage ?? "") as ReactIntlUniversalFormattedMessage;
  }

  /**
   * As same as getHTML(...) API
   * @deprecated Use formatMessage(...) or get(...) as the unified API. This
   * method remains available for legacy HTML-string rendering.
   * @param messageDescriptor options
   * @param variables Variables in message
   * @returns message
   */
  formatHTMLMessage(
    messageDescriptor: ReactIntlUniversalHTMLMessageDescriptor,
    variables?: ReactIntlUniversalVariables
  ): string | ReactElement {
    const { id, defaultMessage } = messageDescriptor;
    return this.getHTML(id, variables).defaultMessage(defaultMessage ?? "");
  }

  /**
   * Helper: determine user's locale via URL, cookie, localStorage, and browser's language.
   * You may not need this API, if you have other rules to determine user's locale.
   * @param options options to determine locale
   * @returns determined locale such as 'en-US'
   */
  determineLocale(options: ReactIntlUniversalOptions = {}): string | null | undefined {
    return (
      this.getLocaleFromURL(options) ||
      this.getLocaleFromCookie(options) ||
      this.getLocaleFromLocalStorage(options) ||
      this.getLocaleFromBrowser()
    );
  }

  /**
   * Change current locale
   * @param newLocale Current locale such as 'en-US'
   */
  changeCurrentLocale(newLocale: string): void {
    if (!this.options.locales || !this.options.locales[newLocale]) {
      let errorMsg = `react-intl-universal locales data "${newLocale}" not exists.`;
      if (!this.options.locales) {
        errorMsg += 'You should call init function first.'
      }
      this.options.warningHandler(errorMsg);
      return;
    }
    this.options.currentLocale = newLocale;
  }

  /**
   * Initialize properties according to currentLocale
   * @param options init options
   * @returns promise for backward compatibility
   */
  init(options: ReactIntlUniversalOptions = {}): Promise<void> {
    invariant(options.currentLocale, "options.currentLocale is required");
    invariant(options.locales, "options.locales is required");

    Object.assign(this.options, options);

    this.options.formats = Object.assign(
      {},
      this.options.formats,
      constants.defaultFormats
    );

    return Promise.resolve();
  }

  /**
   * Get the inital options
   */
  getInitOptions(): ReactIntlUniversalResolvedOptions {
    return this.options;
  }

  /**
   * Load more locales after init
   */
  load(locales: ReactIntlUniversalLocaleMap): void {
    merge(this.options.locales, locales);
  }

  getLocaleFromCookie(options: ReactIntlUniversalOptions): string | undefined {
    const { cookieLocaleKey } = options;
    if (cookieLocaleKey && typeof document !== 'undefined') {
      const cookies = document.cookie.split(';'); // Split on semicolon only
      const cookieObj: Record<string, string> = {};

      cookies.forEach((cookie) => {
        const [key, value] = cookie.trim().split('='); // Trim leading/trailing spaces
        if (key) {
          cookieObj[key] = decodeURIComponent(value); // cookie values may be URL-encoded
        }
      });
      return cookieObj[cookieLocaleKey];
    }
  }

  getLocaleFromLocalStorage(options: ReactIntlUniversalOptions): string | null | undefined {
    const { localStorageLocaleKey } = options;
    if (localStorageLocaleKey && window.localStorage) {
      return localStorage.getItem(localStorageLocaleKey);
    }
  }

  getLocaleFromURL(options: ReactIntlUniversalOptions): string | null | undefined {
    const { urlLocaleKey } = options;
    if (urlLocaleKey) {
      const query = location.search.split("?");
      if (query.length >= 2) {
        const params = new URLSearchParams(query[1]);
        if (params.has(urlLocaleKey)) {
          return params.get(urlLocaleKey);
        }
      }
    }
  }

  getDescendantProp(locale: ReactIntlUniversalLocaleData, key: string): any {

    if (locale[key]) {
      return locale[key];
    }

    const msg = key.split(".").reduce(function (a, b) {
      return (a != undefined) ? a[b] : a;
    }, locale);

    return msg;
  }

  getLocaleFromBrowser(): string | undefined {
    return navigator.language || navigator.userLanguage;
  }

  formatList(nodeList: ReactNode[], options: Intl.ListFormatOptions = { style: 'narrow' }): ReactNode[] {
    if (!Array.isArray(nodeList)) return []
    if (nodeList.length === 0) return [];

    // Create a mapping from placeholder strings to React nodes
    const nodeMap: Record<string, ReactNode> = {};
    const placeholders = nodeList.map((node, index) => {
      const placeholder = index.toString();
      nodeMap[placeholder] = node;
      return placeholder;
    });

    // Create list formatter with specified locale and options
    const formatter = new Intl.ListFormat(this.options.currentLocale || undefined, options);

    // Get formatted parts (elements, literals like separators/conjunctions)
    const parts = formatter.formatToParts(placeholders);

    // Transform formatted parts back to React nodes
    return parts.map(part => {
      // Element is replaced with original nodes
      if (part.type === 'element') {
        return nodeMap[part.value];
      }
      // Literal remains as a string
      return part.value;
    });
  }

  formatParentheses(node: ReactNode): ReactNode[] {
    const currentLocale = this.options.currentLocale;
    const isFullWidth = constants.fullWidthLocales.includes(currentLocale || "");
    return isFullWidth ? ['（', node, '）'] : ['(', node, ')'];
  }

  getColon(): string {
    const currentLocale = this.options.currentLocale;
    const isFullWidth = constants.fullWidthLocales.includes(currentLocale || "");
    return isFullWidth ? '：' : ': ';
  }

  _formatDateTimeValue(
    value: unknown,
    formatter: (date: Date) => string,
    methodName: string
  ): unknown {
    if (!(value instanceof Date) && typeof value !== "number") {
      return value;
    }

    if (value instanceof Date && isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "number" && isNaN(value)) {
      return value;
    }

    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) {
        return value;
      }
      return formatter(date);
    } catch (error) {
      this.options.warningHandler(
        `react-intl-universal ${methodName} failed.`,
        error instanceof Error ? error.message : String(error)
      );
      return value;
    }
  }

  _formatDateParts(date: Date): {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  } {
    return {
      year: String(date.getFullYear()).padStart(4, "0"),
      month: String(date.getMonth() + 1).padStart(2, "0"),
      day: String(date.getDate()).padStart(2, "0"),
      hour: String(date.getHours()).padStart(2, "0"),
      minute: String(date.getMinutes()).padStart(2, "0"),
      second: String(date.getSeconds()).padStart(2, "0"),
    };
  }

  _formatStableDate(date: Date): string {
    const parts = this._formatDateParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  _formatStableTime(date: Date): string {
    const parts = this._formatDateParts(date);
    return `${parts.hour}:${parts.minute}:${parts.second}`;
  }

  _formatStableDateTime(date: Date): string {
    return `${this._formatStableDate(date)} ${this._formatStableTime(date)}`;
  }

  _formatNumberValue(value: unknown): unknown {
    if (typeof value !== 'number' || isNaN(value)) {
      return value;
    }

    try {
      return new Intl.NumberFormat(this.options.currentLocale || undefined, {}).format(value);
    } catch (error) {
      console.error('Error formatting number:', error);
      return value;
    }
  }

  formatDate(value: Date | number): string;
  formatDate<T>(value: T): T;
  formatDate(value: unknown): unknown {
    return this._formatDateTimeValue(value, this._formatStableDate.bind(this), "formatDate");
  }

  formatTime(value: Date | number): string;
  formatTime<T>(value: T): T;
  formatTime(value: unknown): unknown {
    return this._formatDateTimeValue(value, this._formatStableTime.bind(this), "formatTime");
  }

  formatDateTime(value: Date | number): string;
  formatDateTime<T>(value: T): T;
  formatDateTime(value: unknown): unknown {
    return this._formatDateTimeValue(value, this._formatStableDateTime.bind(this), "formatDateTime");
  }

  formatNumber(number: number): string | number;
  formatNumber<T>(number: T): T;
  formatNumber(number: unknown): unknown {
    return this._formatNumberValue(number);
  }

  _getSpanElementMessage(key: string, msg: string): ReactElement & ReactIntlUniversalElementDefaultMessageMethods {
    const options: Record<string, unknown> = {
      dangerouslySetInnerHTML: {
        __html: msg
      }
    };
    if (this.options.debug) {
      options[this.options.dataKey] = key
    }
    const el = React.createElement('span', options);
    // when key exists, it should still return element if there's defaultMessage() after getHTML()
    const defaultMessage = () => el;
    return Object.assign(
      { defaultMessage: defaultMessage, d: defaultMessage },
      el
    );
  }

  _getRichSpanElementMessage(
    key: string,
    chunks: ReactIntlUniversalRichMessageResult,
    variables: ReactIntlUniversalVariables | undefined,
    keyExists: boolean
  ): ReactIntlUniversalRichMessageResult {
    const options: Record<string, unknown> = {};
    if (this.options.debug) {
      options[this.options.dataKey] = key;
    }
    const el = React.createElement('span', options, chunks);
    return this._attachRichMessageHelpers([el], {
      instance: this,
      key,
      variables,
      keyExists,
    });
  }
}

export default ReactIntlUniversal;
