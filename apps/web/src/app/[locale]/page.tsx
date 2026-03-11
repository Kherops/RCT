import {redirect} from '@/i18n/routing';

export default async function HomePage(props: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await props.params;
  redirect({href: '/login', locale});
}
