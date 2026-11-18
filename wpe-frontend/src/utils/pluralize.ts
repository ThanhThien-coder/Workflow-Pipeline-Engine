/** "1 task", "2 tasks": count + correctly inflected noun. */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
