/**
 * Envío de emails, abstraído detrás de una interfaz para poder cambiar de
 * proveedor sin tocar el resto del código de auth. Por ahora solo hay un
 * `ConsoleEmailSender` que imprime el email en el log del servidor: no
 * tenemos credenciales de ningún proveedor real (Resend, Postmark, SMTP...)
 * y no correspondía inventarlas. Para producción, implementar esta interfaz
 * con el proveedor elegido y cambiar el export de `emailSender` más abajo.
 */
export interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(
      `\n--- Email (dev, no enviado de verdad) ---\nPara: ${to}\nAsunto: ${subject}\n\n${body}\n---\n`,
    );
    await Promise.resolve();
  }
}

export const emailSender: EmailSender = new ConsoleEmailSender();
