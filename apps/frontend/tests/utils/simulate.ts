import { userEvent } from '@testing-library/user-event';

/**
 * Utility for simulating user actions in tests.
 * This provides a consistent way to handle user interactions.
 */
export const simulate = {
  /**
   * Clicks on an element.
   * @param element The element to click.
   */
  async click(element: Element | Node | Document | Window) {
    const user = userEvent.setup();
    await user.click(element as HTMLElement);
  },

  /**
   * Types text into an input element.
   * @param element The input element.
   * @param text The text to type.
   */
  async type(element: Element | Node | Document | Window, text: string) {
    const user = userEvent.setup();
    await user.type(element as HTMLElement, text);
  },

  /**
   * Clears an input element and types text.
   * @param element The input element.
   * @param text The text to type.
   */
  async clearAndType(element: Element | Node | Document | Window, text: string) {
    const user = userEvent.setup();
    await user.clear(element as HTMLElement);
    await user.type(element as HTMLElement, text);
  },

  /**
   * Selects an option from a select element.
   * @param element The select element.
   * @param value The value or display text to select.
   */
  async select(element: Element | Node | Document | Window, value: string) {
    const user = userEvent.setup();
    await user.selectOptions(element as HTMLElement, value);
  },

  /**
   * Hovers over an element.
   * @param element The element to hover over.
   */
  async hover(element: Element | Node | Document | Window) {
    const user = userEvent.setup();
    await user.hover(element as HTMLElement);
  },

  /**
   * Uploads a file.
   * @param element The file input element.
   * @param file The file to upload.
   */
  async upload(element: Element | Node | Document | Window, file: File) {
    const user = userEvent.setup();
    await user.upload(element as HTMLElement, file);
  },

  /**
   * Presses a key.
   * @param key The key to press (e.g., '{Enter}', '{Backspace}').
   */
  async keyboard(key: string) {
    const user = userEvent.setup();
    await user.keyboard(key);
  },
};
