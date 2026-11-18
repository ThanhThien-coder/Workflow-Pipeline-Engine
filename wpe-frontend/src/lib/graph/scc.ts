/**
 * Tìm node nằm trên vòng lặp bằng thành phần liên thông mạnh (SCC, Tarjan viết lặp — không đệ quy
 * nên đồ thị rất lớn không tràn stack). Node "nằm trên vòng" khi và chỉ khi thuộc SCC có từ 2 node
 * trở lên, hoặc có cạnh tự nối chính nó. Độ phức tạp O(V + E).
 * Cùng thuật toán với `CycleNodeFinder` ở backend.
 *
 * Cạnh trỏ tới node ngoài `vertices` bị bỏ qua; cạnh trùng không làm sai kết quả.
 */
export function findNodesOnCycle(
  vertices: string[],
  adj: Record<string, string[]>
): Set<string> {
  const vertexSet = new Set(vertices)
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result = new Set<string>()
  let counter = 0

  for (const root of vertices) {
    if (index.has(root)) continue

    // Mỗi phần tử của callStack: node + vị trí cạnh kế tiếp cần duyệt.
    const callStack: { v: string; next: number }[] = []
    const visit = (v: string) => {
      index.set(v, counter)
      low.set(v, counter)
      counter++
      stack.push(v)
      onStack.add(v)
      callStack.push({ v, next: 0 })
    }
    visit(root)

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1]
      const v = frame.v
      const neighbors = adj[v] ?? []
      if (frame.next < neighbors.length) {
        const w = neighbors[frame.next++]
        if (!vertexSet.has(w)) continue
        if (w === v) result.add(v) // cạnh tự nối
        if (!index.has(w)) {
          visit(w)
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v)!, index.get(w)!))
        }
      } else {
        callStack.pop()
        if (low.get(v) === index.get(v)) {
          const component: string[] = []
          let w: string
          do {
            w = stack.pop()!
            onStack.delete(w)
            component.push(w)
          } while (w !== v)
          if (component.length >= 2) component.forEach((c) => result.add(c))
        }
        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1].v
          low.set(parent, Math.min(low.get(parent)!, low.get(v)!))
        }
      }
    }
  }
  return result
}
