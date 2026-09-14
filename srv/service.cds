using { cap01 as my } from '../db/schema';

@path: '/product'
service ProductService {
  entity Products as projection on my.Products;
}
