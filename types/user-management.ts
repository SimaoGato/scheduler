export interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'member'
}
