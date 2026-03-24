import { addCartLine, createCart, getCart } from '@/lib/shopify';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const cartId = request.nextUrl.searchParams.get('cartId');

  if (!cartId) {
    return NextResponse.json({ cart: null });
  }

  try {
    const cart = await getCart(cartId);
    return NextResponse.json({ cart });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load cart.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cartId, merchandiseId, quantity } = body;

    if (!merchandiseId) {
      return NextResponse.json({ error: 'merchandiseId is required.' }, { status: 400 });
    }

    const cart = cartId
      ? await addCartLine(cartId, merchandiseId, quantity ?? 1)
      : await createCart(merchandiseId, quantity ?? 1);

    return NextResponse.json({ cart });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update cart.' },
      { status: 500 }
    );
  }
}
