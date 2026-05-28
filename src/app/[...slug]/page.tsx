import { redirect } from 'next/navigation';

export default function UnknownPage() {
  redirect('/');
}
